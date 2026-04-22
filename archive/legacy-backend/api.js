const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json())

let conversations = []
let messages = []

app.get("/conversations", (req,res)=>{
    res.json(conversations)
})

app.get("/messages/:phone", (req,res)=>{
    const phone = req.params.phone

    const msgs = messages.filter(m => m.phone === phone)

    res.json(msgs)
})

app.post("/send-message", async (req,res)=>{

    const {phone,text} = req.body

    await global.sock.sendMessage(phone,{
        text
    })

    res.json({status:"sent"})
})

app.post("/receive-message",(req,res)=>{

    const {phone,text,name} = req.body

    if(!conversations.find(c=>c.phone===phone)){
        conversations.push({
            phone,
            name,
            lastMessage:text
        })
    }

    messages.push({
        phone,
        text,
        from:"client",
        date:new Date()
    })

    res.json({status:"ok"})
})

app.listen(4000,()=>{
    console.log("API CRM rodando porta 4000")
})