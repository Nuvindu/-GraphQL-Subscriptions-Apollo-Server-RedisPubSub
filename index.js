const { createServer } = require("http");
const express = require("express");
const { execute, subscribe } = require("graphql");
const { ApolloServer, gql } = require("apollo-server-express");
const { PubSub } = require("graphql-subscriptions");
const { SubscriptionServer } = require("subscriptions-transport-ws");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { RedisPubSub } = require("graphql-redis-subscriptions");

(async () => {
  const PORT = 4000
  const pubsub = new RedisPubSub({
    connection: {
      host: 'localhost',
      port: 6379,
      retryStrategy: options => {
        // reconnect after upto 3000 milis
        return 3000;
      }
    }
  });
    const app = express();
    const httpServer = createServer(app);

    const typeDefs = gql`

    type Query {
      viewMessages: [Message!]
    }
    type Mutation {
      sendMessage(params: DataInput): Message!
    }
    type Subscription {
      receiveMessage: Message!
    }
    type Message {
        id: ID!
        name: String!
        content: String
    }
    input DataInput {
      name: String 
      content: String
    }
  `;

  let messages = []
  const resolvers = {
    Query: {
      viewMessages() {
        return messages;
      },
    },
    Mutation: {
      sendMessage: (parent, { params }) => {
        const id = messages.length;
        params.id = id
        var new_message = params;
        messages.push(new_message);
        pubsub.publish("MessageService", {receiveMessage: new_message});
        return new_message;
      },
    },
    Subscription: {
      receiveMessage: {
        subscribe: () => pubsub.asyncIterator(["MessageService"]),
      },
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const server = new ApolloServer({
    schema,
  });
  await server.start();
  server.applyMiddleware({ app });

  SubscriptionServer.create(
    { schema, execute, subscribe },
    { server: httpServer, path: '' }
  );

  httpServer.listen(PORT, () => {
    console.log(
      `Query endpoint ready at http://localhost:${PORT}${server.graphqlPath}`
    );
    console.log(
      `Subscription endpoint ready at ws://localhost:${PORT}${server.graphqlPath}`
    );
  });


})();