import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { books, bookCharacters } from "../seed/books";
import { Construct } from 'constructs';
import * as apig from "aws-cdk-lib/aws-apigateway";


export class BookstoreAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bookstoreFn = new lambdanode.NodejsFunction(this, "BookStoreFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/bookstore.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

 
    //Tables 
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
 
    //Functions 
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
          runtime: lambda.Runtime.NODEJS_16_X,
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
              //TABLE_NAME: movieCastsTable.tableName,
              CAST_TABLE_NAME: bookCharactersTable.tableName,
              BOOKS_TABLE_NAME: booksTable.tableName,
              REGION: "eu-west-1",
            },
          }
        );


        
        //Permissions 
        booksTable.grantReadData(getBookByIdFn)
        booksTable.grantReadData(getAllBooksFn)
        booksTable.grantReadWriteData(newBookFn)
        booksTable.grantReadWriteData(deleteBookFn)
        bookCharactersTable.grantReadData(getBookCharactersMembersFn)
        bookCharactersTable.grantReadData(getBookByIdFn)



        const api = new apig.RestApi(this, "BookstoreAPI", {
          restApiName: "Bookstore API",
          description: "API for Bookstore Application with Translation",
          deployOptions: {
            stageName: "dev",
          },
          defaultCorsPreflightOptions: {
            allowHeaders: ["Content-Type", "X-Amz-Date"],
            allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
            allowCredentials: true,
            allowOrigins: ["*"],
          },
        });


        const booksEndpoint = api.root.addResource("books");

        booksEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getAllBooksFn, { proxy: true })
        );
        
        const bookEndpoint = booksEndpoint.addResource("{bookId}");
        bookEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getBookByIdFn, { proxy: true })
        );
        
        booksEndpoint.addMethod(
          "POST",
          new apig.LambdaIntegration(newBookFn, { proxy: true })
        );
        
        bookEndpoint.addMethod(
          "DELETE",
          new apig.LambdaIntegration(deleteBookFn, { proxy: true })
        );
        
        const bookCharactersEndpoint = booksEndpoint.addResource("characters");
        bookCharactersEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getBookCharactersMembersFn, { proxy: true })
        );

        //URLs
        const bookstoreFnURL = bookstoreFn.addFunctionUrl({
          authType: lambda.FunctionUrlAuthType.AWS_IAM,   
          cors: {
            allowedOrigins: ["*"],
          },
        });
    
    
    
        const getBookByIdURL = getBookByIdFn.addFunctionUrl({
          authType: lambda.FunctionUrlAuthType.NONE,
          cors: {
            allowedOrigins: ["*"],
          },
        });
    
        
        const getAllBooksURL = getAllBooksFn.addFunctionUrl({
          authType: lambda.FunctionUrlAuthType.NONE,
          cors: {
            allowedOrigins: ["*"],
          },
        });
    
        const getBookCharactersURL = getBookCharactersMembersFn.addFunctionUrl({
          authType: lambda.FunctionUrlAuthType.NONE,
          cors: {
            allowedOrigins: ["*"],
     },
     });   
    
        const deleteBookURL = deleteBookFn.addFunctionUrl({
          authType: lambda.FunctionUrlAuthType.NONE,
          cors: {
            allowedOrigins: ["*"],
     },
     });
     

     new cdk.CfnOutput(this, "Get Book Function Url", { value: getBookByIdURL.url });
     new cdk.CfnOutput(this, "BookStore Function Url", { value: bookstoreFnURL.url });
     new cdk.CfnOutput(this, "Get All Books Function Url", { value: getAllBooksURL.url });
     new cdk.CfnOutput(this, "Get Book Characters URL", { value: getBookCharactersURL.url });
     new cdk.CfnOutput(this, "Delete Book Function Url", { value: deleteBookURL.url });
    

      }
    }