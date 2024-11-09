import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import { CookieMap, createPolicy, JwtToken, parseCookies, verifyToken } from "../shared/util";


const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Book"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async function (event: any) {
    try {
        console.log("[EVENT]", JSON.stringify(event));
        
        const cookies: CookieMap = parseCookies(event);
        if (!cookies) {
            return {
                statusCode: 401,
                body: "Unauthorized request!!",
            };
        }

        const verifiedJwt: JwtToken | null = await verifyToken(
            cookies.token,
            process.env.USER_POOL_ID!,
            process.env.REGION!
        );

        if (!verifiedJwt) {
            return {
                statusCode: 401,
                body: "Invalid or expired token!",
            };
        }

    const bookId = event.pathParameters?.bookId;

    if (!bookId || isNaN(Number(bookId))) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Invalid or missing book ID" }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : undefined;
    if (!body) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }

    if (!isValidBodyParams(body)) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Book schema`,
          schema: schema.definitions["Book"],
        }),
      };
    }

    const params = {
      TableName: process.env.TABLE_NAME!,
      Key: { id: Number(bookId) },
      UpdateExpression: "set title = :title, original_title = :original_title, genre = :genre, synopsis = :synopsis, original_language = :original_language, release_date = :release_date",
      ExpressionAttributeValues: {
        ":title": body.title,
        ":original_title": body.original_title,
        ":genre": body.genre,
        ":synopsis": body.synopsis,
        ":original_language": body.original_language,
        ":release_date": body.release_date,
      },
      ReturnValues: "ALL_NEW" as const,
    };

    const commandOutput = await ddbDocClient.send(new UpdateCommand(params));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Book updated successfully",
        updatedItem: commandOutput.Attributes,
      }),
    };
  } catch (error: any) {
    console.error("[ERROR]", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: "An error occurred while updating the book" }),
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