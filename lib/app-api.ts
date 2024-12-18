import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { books, bookCharacters } from "../seed/books";
import { Construct } from 'constructs';
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from 'aws-cdk-lib/aws-iam';

type AppApiProps = {
    userPoolId: string;
    userPoolClientId: string;
  };

export class AppApi extends Construct {
    constructor(scope: Construct, id: string, props: AppApiProps) {
      super(scope, id);

    const bookstoreFn = new lambdanode.NodejsFunction(this, "BookStoreFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/bookstore.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
        architecture: lambda.Architecture.ARM_64,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "handler",
        entry: "./lambdas/auth/authorizer.ts",
        environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
  }});

    const requestAuthorizer = new apig.RequestAuthorizer(
        this,
        "RequestAuthorizer",
        {
          identitySources: [apig.IdentitySource.header("cookie")],
          handler: authorizerFn,
          resultsCacheTtl: cdk.Duration.minutes(0),
        }
      );

 
    const booksTable = new dynamodb.Table(this, "BooksTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Books",
    });

    const bookCharactersTable = new dynamodb.Table(this, "bookCharactersTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "bookId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "characterName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "BookCharacters",
    });

    bookCharactersTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    const translateTable = new dynamodb.Table(this, "translateTable", {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        partitionKey: { name: "bookId", type: dynamodb.AttributeType.NUMBER },
        sortKey: { name: "language", type: dynamodb.AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        tableName: "TranslateBook",
      });
 

    const getBookByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetBookByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getBookById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: booksTable.tableName,
          CAST_TABLE_NAME: bookCharactersTable.tableName,
          REGION: 'eu-west-1',
        },
      }
      );

      
      const getAllBooksFn = new lambdanode.NodejsFunction(
        this,
        "GetAllBooksFn",
        {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/getAllBooks.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: booksTable.tableName,
            REGION: 'eu-west-1',
          },
        }
        );

        new custom.AwsCustomResource(this, "booksddbInitData", {
          onCreate: {
            service: "DynamoDB",
            action: "batchWriteItem",
            parameters: {
              RequestItems: {
                [booksTable.tableName]: generateBatch(books),
                [bookCharactersTable.tableName]: generateBatch(bookCharacters),  
              },
            },
            physicalResourceId: custom.PhysicalResourceId.of("booksddbInitData"), 
          },
          policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [booksTable.tableArn, bookCharactersTable.tableArn],  
          }),
        });

        const newBookFn = new lambdanode.NodejsFunction(this, "AddBookFn", {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/addBook.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: booksTable.tableName,
            REGION: "eu-west-1",
          },
        });

        const deleteBookFn = new lambdanode.NodejsFunction(this, "DeleteBookFn", {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/deleteBook.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: booksTable.tableName,  
            REGION: 'eu-west-1',
          },
        });

        const updateBookFn = new lambdanode.NodejsFunction(this, "UpdateBookFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: `${__dirname}/../lambdas/updateBook.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: booksTable.tableName,
                USER_POOL_ID: props.userPoolId,
                CLIENT_ID: props.userPoolClientId,
                REGION: "eu-west-1",
              },
            });

        const getBookCharactersMembersFn = new lambdanode.NodejsFunction(
          this,
          "GetBookCharactersMembersFn",
          {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: `${__dirname}/../lambdas/getBookCharactersMembers.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
              CAST_TABLE_NAME: bookCharactersTable.tableName,
              BOOKS_TABLE_NAME: booksTable.tableName,
              REGION: "eu-west-1",
            },
          }
        );

        const getTranslateBookFn = new lambdanode.NodejsFunction(
            this,
            "getTranslateBookFn",
            {
              architecture: lambda.Architecture.ARM_64,
              runtime: lambda.Runtime.NODEJS_18_X,
              entry: `${__dirname}/../lambdas/translate.ts`,
              timeout: cdk.Duration.seconds(10),
              memorySize: 128,
              environment: {
                TRANSLATE_TABLE_NAME: translateTable.tableName,
                BOOKS_TABLE_NAME: booksTable.tableName,
                REGION: "eu-west-1",
              },
            }
          );
        
        booksTable.grantReadData(getBookByIdFn)
        booksTable.grantReadData(getAllBooksFn)
        booksTable.grantReadWriteData(newBookFn)
        booksTable.grantReadWriteData(deleteBookFn)
        booksTable.grantReadWriteData(updateBookFn)
        booksTable.grantReadWriteData(getTranslateBookFn)
        translateTable.grantReadWriteData(getTranslateBookFn)
        bookCharactersTable.grantReadData(getBookCharactersMembersFn)
        bookCharactersTable.grantReadData(getBookByIdFn)


        const appApi = new apig.RestApi(this, "AppAPI", {
          restApiName: "App API",
          description: "API for Bookstore Application with Translation",
          endpointTypes: [apig.EndpointType.REGIONAL],
          deployOptions: {
            stageName: "dev",
          },
          defaultCorsPreflightOptions: {
            allowOrigins: apig.Cors.ALL_ORIGINS,
          },
        });

        const booksEndpoint = appApi.root.addResource("books");

        booksEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getAllBooksFn, { proxy: true })
        );
        
        const bookEndpoint = booksEndpoint.addResource("{bookId}");
        bookEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getBookByIdFn, { proxy: true })
        );
        
        const bookCharactersEndpoint = booksEndpoint.addResource("characters");
        bookCharactersEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getBookCharactersMembersFn, { proxy: true })
        );

        booksEndpoint.addMethod( "POST", new apig.LambdaIntegration(newBookFn, { proxy: true }), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        }
        );

        bookEndpoint.addMethod( "DELETE", new apig.LambdaIntegration(deleteBookFn, { proxy: true }), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        }
        );
        
        bookEndpoint.addMethod( "PUT", new apig.LambdaIntegration(updateBookFn, { proxy: true }), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        }
        );

        const translationEndpoint = bookEndpoint.addResource("Translate");
        translationEndpoint.addMethod( "GET", new apig.LambdaIntegration(getTranslateBookFn, { proxy: true }));


        getTranslateBookFn.addToRolePolicy(new iam.PolicyStatement ({
            actions: ['translate:TranslateText'],
            resources: ['*']
          })
          )

      }
    }