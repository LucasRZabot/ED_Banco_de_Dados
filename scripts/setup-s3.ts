/**
 * Cria o bucket privado e aplica CORS/bloqueio de acesso público.
 * Em dev roda contra o S3 local (moto); em prod o bucket deve vir do IaC — use só para conferir.
 */
import "dotenv/config";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  S3Client,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET!;
const region = process.env.AWS_REGION!;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

const s3 = new S3Client({
  region,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

async function main() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket ${bucket} já existe.`);
  } catch {
    await s3.send(
      new CreateBucketCommand({
        Bucket: bucket,
        CreateBucketConfiguration:
          region === "us-east-1" ? undefined : { LocationConstraint: region as BucketLocationConstraint },
      }),
    );
    console.log(`Bucket ${bucket} criado.`);
  }

  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    }),
  );

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [appUrl],
            AllowedMethods: ["PUT", "GET"],
            AllowedHeaders: ["Content-Type"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
  console.log(`CORS liberado para ${appUrl}; acesso público bloqueado.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
