// /* eslint-disable import/extensions, import/no-absolute-path */
// import { SQSHandler } from "aws-lambda";
// import {
//   GetObjectCommand,
//   PutObjectCommandInput,
//   GetObjectCommandInput,
//   S3Client,
//   PutObjectCommand,
// } from "@aws-sdk/client-s3";

// const s3 = new S3Client();

// export const handler: SQSHandler = async (event) => {
//   console.log("Event ", event);
//   for (const record of event.Records) {
//     const recordBody = JSON.parse(record.body);  // Parse SQS message
//     const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

//     if (snsMessage.Records) {
//       console.log("Record body ", JSON.stringify(snsMessage));
//       for (const messageRecord of snsMessage.Records) {
//         const s3e = messageRecord.s3;
//         const srcBucket = s3e.bucket.name;
//         // Object key may have spaces or unicode non-ASCII characters.
//         const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
//         let origimage = null;
//         try {
//           // Download the image from the S3 source bucket.
//           const params: GetObjectCommandInput = {
//             Bucket: srcBucket,
//             Key: srcKey,
//           };
//           origimage = await s3.send(new GetObjectCommand(params));
//           // Process the image ......
//         } catch (error) {
//           console.log(error);
//         }
//       }
//     }
//   }
// };

/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
// import { sharp } from "/opt/nodejs/sharp-utils";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", event);
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    console.log('Raw SNS message ',JSON.stringify(recordBody))
    if (recordBody.Records) {
      for (const messageRecord of recordBody.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        // Infer the image type from the file suffix.
        const typeMatch = srcKey.match(/\.([^.]*)$/);
        if (!typeMatch) {
          console.log("Could not determine the image type.");
          throw new Error("Could not determine the image type. ");
        }
        // Check that the image type is supported
        const imageType = typeMatch[1].toLowerCase();
        if (imageType != "jpeg" && imageType != "png") {
          console.log(`Unsupported image type: ${imageType}`);
          throw new Error("Unsupported image type: ${imageType. ");
        }
        // process image upload 
      }
    }
  }
};