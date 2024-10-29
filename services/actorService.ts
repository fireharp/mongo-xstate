import * as mongoDB from "mongodb";
import { AnyStateMachine, createActor } from "xstate";

// mongoDB collections
export const collections: {
  machineStates?: mongoDB.Collection;
  creditReports?: mongoDB.Collection;
  creditProfiles?: mongoDB.Collection;
  userStates?: mongoDB.Collection;
} = {};

// Initialize DB Connection and Credit Check Actor
export async function initDbConnection() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    
    const client = new mongoDB.MongoClient(uri, {
      serverApi: mongoDB.ServerApiVersion.v1,
    });
    const db = client.db("creditCheck");
    collections.machineStates = db.collection("machineStates");
    collections.userStates = db.collection("userStates");
    await client.connect();
  } catch (err) {
    console.log("Error connecting to the db...", err);
    throw err;
  }
}

// create an actor to be used in the API endpoints
// hydrate the actor if an actorId is provided
// otherwise, create a new ID
// persist the actor state to the db
export async function getDurableActor({
  machine,
  actorId,
}: {
  // Update the type to accept either a StateMachine instance or a machine creator
  machine: AnyStateMachine | { createMachine: (...args: any[]) => AnyStateMachine };
  actorId?: string;
}) {
  // Ensure we have a machine instance
  const machineInstance = 'createMachine' in machine 
    ? machine.createMachine({}) 
    : machine;

  let restoredState;
  const collection = machineInstance.id === "SimpleUserFlow" ? collections.userStates : collections.machineStates;

  if (actorId) {
    restoredState = await collection?.findOne({
      actorId,
    });

    if (!restoredState) {
      throw new Error("Actor not found with the provided ID");
    }

    console.log("restored state", restoredState);
  } else {
    actorId = generateActorId();
  }

  const actor = createActor(machineInstance, {
    snapshot: restoredState?.persistedState,
  });

  actor.subscribe({
    next: async () => {
      const persistedState = actor.getPersistedSnapshot();
      console.log("persisted state", persistedState);
      const result = await collection?.replaceOne(
        {
          actorId,
        },
        {
          actorId,
          persistedState,
        },
        { upsert: true },
      );

      if (!result?.acknowledged) {
        throw new Error(
          "Error persisting actor state. Verify db connection is configured correctly.",
        );
      }
    },
    error: (err) => {
      console.log("Error in actor subscription: " + err);
      throw err;
    },
    complete: async () => {
      console.log("Actor is finished!");
      actor.stop();
    },
  });
  actor.start();

  return { actor, actorId };
}

function generateActorId() {
  return Math.random().toString(36).substring(2, 8);
}
