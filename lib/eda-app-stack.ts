import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";


import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    const imagesTable = new dynamodb.Table(this, "ImagesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "name", type: dynamodb.AttributeType.STRING },
      // sortKey: { name: "name", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Images",
    });

    // Integration infrastructure

    const badImagesQueue = new sqs.Queue(this, "bad-images-q", {
      retentionPeriod: cdk.Duration.minutes(30),
    });

    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });

    const newImageTopic = new sns.Topic(this, "NewImageTopic", {
      displayName: "New Image topic",
    }); 

    const mailerQ = new sqs.Queue(this, "mailer-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });

    const rejectionMailerQ = new sqs.Queue(this, "rejection-mailer-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });


    // const ImagesQueue = new sqs.Queue(this, "bad-orders-q", {
    //   retentionPeriod: cdk.Duration.minutes(30),
    // });

    const ImagesQueue = new sqs.Queue(this, "images-queue", {
      deadLetterQueue: {
        queue: badImagesQueue,
        // # of rejections (lambda function)
        maxReceiveCount: 2,
      },
    });


    // Lambda functions

    const processImageFn = new lambdanode.NodejsFunction(
      this,
      "ProcessImageFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/processImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
        },
  
      }
    );

    const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/mailer.ts`,
    });

    const rejectedMailerFn = new lambdanode.NodejsFunction(this, "rejection_mailer-function", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/handleBadImage.ts`,
    });

    // new custom.AwsCustomResource(this, "imagesddbInitData", {
    //   onCreate: {
    //     service: "DynamoDB",
    //     action: "batchWriteItem",
    //     parameters: {
    //       RequestItems: {
    //         [imagesTable.tableName]: generateBatch(),
    //       },

    //     },
    //     physicalResourceId: custom.PhysicalResourceId.of("imagesddbInitData"), //.of(Date.now().toString()),
    //   },
    //   policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
    //     resources: [imagesTable.tableArn],
    //   }),
    // });

    // Event triggers

    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(newImageTopic),
      // {suffix: 'jpeg'}
    );

    newImageTopic.addSubscription(
      new subs.SqsSubscription(ImagesQueue)
    );
    // newImageTopic.addSubscription(
      // new subs.SqsSubscription(mailerQ)
    // );

    newImageTopic.addSubscription(new subs.SqsSubscription(mailerQ, {
      // filterPolicy: {
        // source: sns.SubscriptionFilter.stringFilter({
          // matchPrefixes: ['jpeg','png']
      // })},
    })
    );

    newImageTopic.addSubscription(new subs.SqsSubscription(rejectionMailerQ));


    // Event sources for lambda functions

    processImageFn.addEventSource(
      new events.SqsEventSource(ImagesQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5),
        maxConcurrency: 2,
      })
    );
    processImageFn.addEventSource(
      new events.SqsEventSource(badImagesQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5),
        maxConcurrency: 2,
      })
    );

    
    // const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
      // batchSize: 5,
      // maxBatchingWindow: cdk.Duration.seconds(10),
    // });

    // processImageFn.addEventSource(newImageEventSource);

    mailerFn.addEventSource(
      new events.SqsEventSource(mailerQ, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(10),
    }));

    rejectedMailerFn.addEventSource(
      new events.SqsEventSource(rejectionMailerQ, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(10),
    }));

    ImagesQueue.grantSendMessages(processImageFn);

    // Permissions

    imagesBucket.grantReadWrite(processImageFn);

    mailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    rejectedMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    imagesTable.grantReadWriteData(processImageFn)


    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
