const express = require("express");

const app = express();

app.get("/cfg/:mac", async (req, res) => {
  if (!req.params.mac.endsWith(".cfg")) {
    res.sendStatus(404);
    return;
  }

  if (req.params.mac == "y000000000123.cfg") {
    res.sendStatus(404);
    return;
  }

  console.log("====================================");
  console.dir(req)
  res.sendStatus(200);
});

app.listen(8080, () => {
  console.log("Server running on port 8080");
});