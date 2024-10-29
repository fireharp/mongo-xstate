import bodyParser from "body-parser";
import dotenv from "dotenv";
import express from "express";
import { creditCheckMachine, userStateMachine } from "./machine";
import {
  collections,
  getDurableActor,
  initDbConnection,
} from "./services/actorService";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const app = express();

app.use(bodyParser.json());

// Endpoint to start a new workflow instance
app.post("/workflows", async (_req, res) => {
  console.log("starting new workflow...");
  try {
    const { actorId } = await getDurableActor({
      machine: creditCheckMachine,
    });
    res
      .status(201)
      .json({ message: "New workflow created successfully", actorId });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error starting workflow. Details: " + err);
  }
});

// Endpoint to send events to an existing workflow instance
app.post("/workflows/:actorId", async (req, res) => {
  const { actorId } = req.params;
  const event = req.body;

  try {
    const { actor } = await getDurableActor({
      machine: creditCheckMachine,
      actorId,
    });
    actor.send(event);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error sending event. Details: " + err);
  }

  res
    .status(200)
    .send(
      "Event received. Issue a GET request to see the current workflow state"
    );
});

// Endpoint to get the current state of an existing workflow instance
app.get("/workflows/:actorId", async (req, res) => {
  const { actorId } = req.params;
  const persistedState = await collections.machineStates?.findOne({
    actorId,
  });

  if (!persistedState) {
    return res.status(404).send("Workflow state not found");
  }

  res.json(persistedState);
});

// Create a new user
app.post("/users", async (_req, res) => {
  try {
    const { actorId } = await getDurableActor({
      machine: userStateMachine,
    });
    res.status(201).json({ message: "New user created successfully", actorId });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating user. Details: " + err);
  }
});

// Send events to an existing user
app.post("/users/:actorId", async (req, res) => {
  const { actorId } = req.params;
  const event = req.body;

  try {
    const { actor } = await getDurableActor({
      machine: userStateMachine,
      actorId,
    });
    actor.send(event);
    res.status(200).send("Event received. Check user state.");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error sending event. Details: " + err);
  }
});

// Get the current state of a user
app.get("/users/:actorId", async (req, res) => {
  const { actorId } = req.params;
  const persistedState = await collections.userStates?.findOne({
    actorId,
  });

  if (!persistedState) {
    return res.status(404).send("User state not found");
  }

  res.json(persistedState);
});

app.get("/", (_, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif;">
        <h1>Express Workflow</h1>
        <p>Start a new workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows</pre>
        <p>Send an event to a workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows/:actorId -d '{"type":"TIMER"}'</pre>
        <p>Get the current state of a workflow instance:</p>
        <pre>curl -X GET http://localhost:4242/workflows/:actorId</pre>
      </body>
    </html>
  `);
});

// Connect to the DB and start the server
initDbConnection().then(() => {
  app.listen(4242, () => {
    console.log("Server listening on port 4242");
  });
});
