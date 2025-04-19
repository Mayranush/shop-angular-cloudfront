import {
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_s3,
  aws_s3_deployment,
  aws_iam,
  CfnOutput,
  RemovalPolicy,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const path = './resources/browser';

export class DeploymentService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const hostingBucket = new aws_s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new aws_cloudfront.Distribution(
      this,
      'CloudfrontDistribution',
      {
        defaultBehavior: {
          origin: new aws_cloudfront_origins.S3Origin(hostingBucket),
          viewerProtocolPolicy:
            aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
      },
    );

    const deployRole = new aws_iam.Role(this, 'BucketDeploymentRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    deployRole.addToPolicy(
      new aws_iam.PolicyStatement({
        actions: [
          'cloudfront:GetInvalidation',
          'cloudfront:CreateInvalidation',
        ],
        resources: [
          `arn:aws:cloudfront::851725595304:distribution/${distribution.distributionId}`,
        ],
      }),
    );

    new aws_s3_deployment.BucketDeployment(this, 'BucketDeployment', {
      sources: [aws_s3_deployment.Source.asset(path)],
      destinationBucket: hostingBucket,
      distribution,
      distributionPaths: ['/*'],
      role: deployRole,
      logRetention: logs.RetentionDays.ONE_DAY, // Optional: adds logging
      memoryLimit: 512, // Optional: customize for large sites
    });

    // Optional outputs
    new CfnOutput(this, 'BucketName', {
      value: hostingBucket.bucketName,
    });

    new CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.domainName}`,
    });
  }
}
