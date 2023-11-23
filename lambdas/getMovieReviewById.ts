import { APIGatewayProxyHandlerV2 } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => { // Note change
  try {
    console.log("Event: ", event);
    const parameters  = event?.pathParameters;
    const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    const reviewerName = parameters?.reviewerName;
    const minRating = event?.queryStringParameters?.minRating;

    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie Id" }),
      };
    }

    let queryInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: "movieId = :id", // Partition key.
      ExpressionAttributeValues: {
        ":id": movieId,
      },
    };

    if (reviewerName) {
      queryInput = {
        ...queryInput,
        FilterExpression: "reviewerName = :name", // Filter if reviewerName exists
        ExpressionAttributeValues: {
          ...queryInput.ExpressionAttributeValues,
          ":name": reviewerName,
        },
      };
    }

    if (minRating !== undefined && !isNaN(parseFloat(minRating))) { //If minRating is including in the request, and is a number (not a not a number) once parsed to a float
      queryInput = {
        ...queryInput,
        FilterExpression: "reviewRating >= :rating", //Min rating so will search for reviews with a rating of greater than or equal to what's specified in the request.
        ExpressionAttributeValues: {
          ...queryInput.ExpressionAttributeValues,
          ":rating": parseFloat(minRating),
        },
      };
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(queryInput));

    console.log("GetCommand response: ", commandOutput);
    if (!commandOutput.Items) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "No reviews found" }),
      };
    }
    const body = {
      data: commandOutput.Items,
    };

    // Return Response
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}