import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";

import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/movieReviews";
import { movieReviewss } from "../seed/movieReviewss";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Table
    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER }, //MovieID is the primary key
      sortKey: { name: "reviewDate", type: dynamodb.AttributeType.STRING }, //reviewDate is the sort key
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    // Functions 
      const getMovieReviewByIdFn = new lambdanode.NodejsFunction(
        this,
        "GetMovieReviewByIdFn",
        {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_16_X,
          entry: `${__dirname}/../lambdas/getMovieReviewById.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: movieReviewsTable.tableName,
            REGION: 'eu-west-1',
          },
        }
        );

        const getAllMovieReviewsFn = new lambdanode.NodejsFunction(
          this,
          "GetAllMovieReviewsFn",
          {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambdas/getAllMovieReviews.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
              TABLE_NAME: movieReviewsTable.tableName,
              REGION: 'eu-west-1',
            },
          }
          );

        const newMovieReviewFn = new lambdanode.NodejsFunction(this, "AddMovieReviewFn", {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_16_X,
          entry: `${__dirname}/../lambdas/addMovieReview.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: movieReviewsTable.tableName,
            REGION: "eu-west-1",
          },
        });

        new custom.AwsCustomResource(this, "movieReviewsddbInitData", {
          onCreate: {
            service: "DynamoDB",
            action: "batchWriteItem",
            parameters: {
              RequestItems: {
                [movieReviewsTable.tableName]: generateBatch(movieReviewss)
              },
            },
            physicalResourceId: custom.PhysicalResourceId.of("movieReviewsddbInitData"),
          },
          policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [movieReviewsTable.tableArn, movieReviewsTable.tableArn],
          }),
        });
        
        // Permissions 
        movieReviewsTable.grantReadData(getMovieReviewByIdFn)
        movieReviewsTable.grantReadData(getAllMovieReviewsFn)
        movieReviewsTable.grantReadWriteData(newMovieReviewFn)
        
        const api = new apig.RestApi(this, "RestAPI", {
          description: "rest api ca1",
          deployOptions: {
            stageName: "dev",
          },
          // 👇 enable CORS
          defaultCorsPreflightOptions: {
            allowHeaders: ["Content-Type", "X-Amz-Date"],
            allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
            allowCredentials: true,
            allowOrigins: ["*"],
          },
        });
    
        const moviesEndpoint = api.root.addResource("movies");
        const movieEndpoint = moviesEndpoint.addResource("{movieId}");
        const reviewsEndpoint = moviesEndpoint.addResource("reviews");
        const reviewEndpoint = movieEndpoint.addResource("reviews");
        const reviewerNameEndpoint = reviewEndpoint.addResource("{reviewerName}");

        reviewsEndpoint.addMethod(
          "POST",
          new apig.LambdaIntegration(newMovieReviewFn, { proxy: true })
        );

        reviewEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
        );

        reviewerNameEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
        )
      }
    }