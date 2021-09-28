const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongodb = require("mongodb");
const mongoose = require("mongoose");

// Middlewares

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false })); // for posts

// DB Connection

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MONGODB connection error: "));

const Schema = mongoose.Schema;

const userSchema = new Schema({
    "username": {
        type: String,
        required: true
    },
    "exercises": [{
        "description": {
            type: String
        },
        "duration": {
            type: Number
        },
        "date": {
            type: String
        }
    }]
});

const Users = mongoose.model("Users", userSchema);

// Routes

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});

app.route("/api/users")
    .get(async (req, res) => {
        const userList = await Users.find({}, '-__v ').exec();
        res.json(userList);
    })
    .post(async (req, res) => {
        let user,
            errorMessage
        try {
            user = new Users({
                username: req.body.username
            });
            await user.save();
        } catch (err) {
            if (err) {
                errorMessage = err;
                res.json({
                    error: errorMessage
                })
            }
        }
        if (!errorMessage) {
            res.json({
                username: user.username,
                _id: user.id
            });
        }
    })
    .delete(async (req, res) => {
        try {
            await Users.deleteMany({}).exec();
        } catch (err) {
            return res.json({
                error: err
            })
        }

        return res.json({
            message: "Deleted"
        })
    });

app.post("/api/users/:_id/exercises", async (req, res) => {
    const id = req.body[":_id"] || req.params._id;


    const dater = () => {
        const defaultDate = () => new Date().toISOString().slice(0, 10);
        const date = req.body.date || defaultDate();
        return new Date(date).toDateString();
    }

    const exerciseObj = {
        description: req.body.description,
        duration: +req.body.duration,
        date: dater()
    };

    let user;

    // Find user
    try {
        user = await Users.findByIdAndUpdate(id, { $push: { exercises: exerciseObj } }).exec();

    } catch (err) {
        if (err) {
            return res.json({
                error: err
            });
        }
    }

    const response = {
        _id: user.id,
        username: user.username,
        description: exerciseObj.description,
        duration: exerciseObj.duration,
        date: exerciseObj.date
    }

    return res.json(response);
});

app.get("/api/users/:_id/logs", async (req, res) => {

    const { from, to, limit } = req.query;

    const { "_id": id } = req.params;
    let user;

    try {
        user = await Users.findById(id, '-__v -exercises._id');
    } catch (err) {
        return res.json({
            error: err
        })
    }

    const formatDate = (val) => {
        return new Date(val).getTime();
    }

    const dateRegEx = /\d+-\d{2}-\d{2}/;
    const numberRegEx = /^\d+$/;
    
    let filtered = user.exercises;
    if (dateRegEx.test(from)) {
        filtered = filtered.filter(x => formatDate(x.date) >= formatDate(from));
    }
    if (dateRegEx.test(to)) {
        filtered = filtered.filter(x => formatDate(x.date) <= formatDate(to));
    }

    if (numberRegEx.test(limit)) {
        filtered = filtered.slice(0, parseInt(limit));
    }

    user.exercises = filtered;

    const response = {
        username: user.username,
        count: user.exercises.length,
        _id: user.id,
        log: user.exercises
    }
    return res.json(response);
})

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
