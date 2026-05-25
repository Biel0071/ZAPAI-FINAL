import { io } from "socket.io-client";
import axios from "axios";

const API_URL = "http://localhost:4025";
const USERNAME = "zapadmin";
const PASSWORD = "zapadmin123";

async function run() {
  console.log("1. Logging in...");
  try {
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: USERNAME,
      password: PASSWORD,
      tenantId: "default",
    });

    const loginData = loginRes.data;
    const token = loginData.token || loginData.data?.token;
    if (!token) {
      console.error("Login response lacks token:", loginData);
      process.exit(1);
    }
    console.log("Logged in successfully, token obtained.");

    console.log("2. Connecting Socket.IO client...");
    const socket = io(API_URL, {
      transports: ["websocket"],
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("Socket connected! ID:", socket.id);
      
      // Now trigger session start
      triggerSessionStart(token);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect_error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    // Listen to all possible QR/status events
    const events = [
      "session_qr",
      "qr_generated",
      "qr.update",
      "session_status",
      "session:status",
      "connection:event",
      "connection.update",
      "connection-update",
      "session_connected",
      "session_disconnected"
    ];

    events.forEach(event => {
      socket.on(event, (payload) => {
        console.log(`[EVENT RECEIVED: ${event}]`, JSON.stringify(payload, null, 2));
      });
    });
  } catch (error) {
    console.error("Error running login or socket connection:", error.message || error);
    process.exit(1);
  }
}

async function triggerSessionStart(token) {
  const sessionName = "test_socket_session_" + Date.now();
  console.log(`3. Starting session: ${sessionName}...`);
  try {
    const res = await axios.post(`${API_URL}/api/session/start`, 
      { name: sessionName },
      {
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      }
    );

    console.log("Start session HTTP response status:", res.status);
    console.log("Start session response:", res.data);
  } catch (error) {
    console.error("Error triggering session start:", error.response?.data || error.message);
  }
}

run();
