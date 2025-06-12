const express = require("express");
const app = express();
const path = require("path");
const indexRouter = require("./routes/index");

const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);

let waitingUsers = [];
let rooms = {};

io.on("connection", (socket) => {
  console.log("connected from the web browser");
  socket.on("joinroom", () => {
    if (waitingUsers.length > 0) {
      let partner = waitingUsers.shift();
      const roomname = `${socket.id}-${partner.id}`;
      socket.join(roomname);
      partner.join(roomname);

      io.to(roomname).emit("joined", roomname);
    } else {
      waitingUsers.push(socket);
    }
  });
  socket.on("disconnect", () => {
    let index = waitingUsers.findIndex(
      (waitingUser) => waitingUser.id === socket.id
    );
    waitingUsers.splice(index, 1);
  });

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
