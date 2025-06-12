const express = require("express");
const app = express();
const path = require("path");
const indexRouter = require("./routes/index");

const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);
//
// In your app.js file
//

let waitingUsers = [];

io.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected.`);

  // Track the state for this specific socket connection
  socket.partner = null;
  socket.roomname = null;

  socket.on("joinroom", () => {
    // If there's a user waiting, let's pair them up.
    if (waitingUsers.length > 0) {
      // Take the first waiting user as our partner
      let partner = waitingUsers.shift();
      const roomname = `${socket.id}-${partner.id}`;

      // Assign state to both users
      socket.partner = partner;
      partner.partner = socket;
      socket.roomname = roomname;
      partner.roomname = roomname;

      // Join them to the same room
      socket.join(roomname);
      partner.join(roomname);

      // Notify both users that they have been successfully paired
      io.to(roomname).emit("joined", roomname);
      console.log(`Paired ${socket.id} and ${partner.id} in room ${roomname}`);
    } else {
      // If no one is waiting, this user becomes the waiting user
      waitingUsers.push(socket);
      console.log(`Socket ${socket.id} is waiting for a partner.`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected.`);

    // If the disconnected user had a partner, handle the remaining user.
    if (socket.partner) {
      const partner = socket.partner;
      const room = socket.roomname;

      console.log(`Partner ${partner.id} is now alone.`);

      // Notify the partner that their counterpart has disconnected.
      // This is the trigger for the client-side UI reset.
      io.to(room).emit("partnerDisconnected");

      // Clear the partner's state
      partner.partner = null;
      partner.roomname = null;

      // Make the partner leave the old room. This is important cleanup.
      partner.leave(room);

      // Put the lone partner back into the waiting queue for the next user.
      waitingUsers.push(partner);
    } else {
      // If the user was just in the waiting queue, remove them.
      waitingUsers = waitingUsers.filter((user) => user.id !== socket.id);
    }
    console.log(
      "Waiting users:",
      waitingUsers.map((u) => u.id)
    );
  });

  // --- Signaling and messaging events (These remain unchanged) ---

  socket.on("signalingMessage", (data) => {
    socket.broadcast.to(data.room).emit("signalingMessage", data.message);
  });

  socket.on("startVideoCall", (data) => {
    socket.broadcast.to(data.room).emit("incomingCall");
  });

  socket.on("rejectCall", (data) => {
    socket.broadcast.to(data.room).emit("callRejected");
  });

  socket.on("acceptCall", (data) => {
    socket.broadcast.to(data.room).emit("callAccepted", data.room);
  });

  socket.on("message", (data) => {
    socket.broadcast.to(data.room).emit("message", data.message);
  });

  socket.on("typing", (data) => {
    socket.broadcast.to(data.room).emit("typing", data);
  });

  socket.on("stoptyping", (data) => {
    socket.broadcast.to(data.room).emit("stoptyping", data);
  });
});

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

server.listen(process.env.PORT || 3000);
