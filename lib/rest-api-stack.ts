import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";

import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/movieReviews";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Table
    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER }, 
      sortKey: { name: "ReviewerName", type: dynamodb.AttributeType.STRING }, 
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
        }
        );

        // const updateReviewFn = new lambdanode.NodejsFunction(this, "UpdateReviewFn", {
        //   architecture: lambda.Architecture.ARM_64,
        //   runtime: lambda.Runtime.NODEJS_16_X,
        //   entry: `${__dirname}/../lambda/putReview.ts`,
        //   timeout: cdk.Duration.seconds(10),
        //   memorySize: 128,
        //   environment: {
        //     TABLE_NAME: movieReviewsTable.tableName,
        //     REGION: "eu-west-1",
        //   },
        // }
        // );

        new custom.AwsCustomResource(this, "movieReviewsddbInitData", {
          onCreate: {
            service: "DynamoDB",
            action: "batchWriteItem",
            parameters: {
              RequestItems: {
                [movieReviewsTable.tableName]: generateBatch(movieReviews)
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
        //movieReviewsTable.grantReadWriteData(updateReviewFn)
      
           //REST API
      const api = new apig.RestApi(this, "RestAPI", {
        description: "Assignment 1 API",
        deployOptions: {
          stageName: "dev",
        },
        
        defaultCorsPreflightOptions: {
          allowHeaders: ["Content-Type", "X-Amz-Date"],
          allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
          allowCredentials: true,
          allowOrigins: ["*"],
        },
      }
      )
  
      
      const moviesEndpoint = api.root.addResource("movies");
  
      
      const reviewsEndpoint = moviesEndpoint.addResource("reviews")
    
  
      
      const getAllReviewsrEndpoint = reviewsEndpoint.addResource("{reviewerName}")
      getAllReviewsByrEndpoint.addMethod(
        "GET",
        new apig.LambdaIntegration(newMovieReviewFn, { proxy: true })
      )
  
  
      
      const movieIdEndpoint = moviesEndpoint.addResource("{movieId}");
  
      
      const movieReviewsEndpoint = movieIdEndpoint.addResource("reviews");
      movieReviewsEndpoint.addMethod(
        "GET",
        new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
      )
  
      
      const movieReviewsByEndpoint = movieReviewsEndpoint.addResource("{reviewerName}");
      movieReviewsByEndpoint.addMethod(
        "GET",
        new apig.LambdaIntegration(getAllMovieReviewsFn, { proxy: true })
      )

      movieReviewsByAuthorEndpoint.addMethod(
        "PUT",
        //new apig.LambdaIntegration(updateReviewFn, { proxy: true }),
      )
       }
    }
    
