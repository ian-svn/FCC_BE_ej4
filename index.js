const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/exercise-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

// Import models
const User = require('./models/User')
const Exercise = require('./models/Exercise')

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

// Create a new user (POST /api/users)
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: 'username is required' })
    }
    const user = new User({ username: username.trim() })
    await user.save()
    res.json({ username: user.username, _id: user._id })
  } catch (err) {
    // Si el usuario ya existe, buscarlo y devolverlo
    if (err.code === 11000) {
      const user = await User.findOne({ username: req.body.username })
      return res.json({ username: user.username, _id: user._id })
    }
    res.status(400).json({ error: err.message })
  }
})

// Get all users (GET /api/users)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id')
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Add exercise (POST /api/users/:_id/exercises)
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { _id } = req.params
    let { description, duration, date } = req.body
    
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'description is required' })
    }
    if (!duration || isNaN(duration)) {
      return res.status(400).json({ error: 'duration is required and must be a number' })
    }
    duration = parseInt(duration)
    if (date && isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'date must be a valid date string' })
    }
    const user = await User.findById(_id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const exercise = new Exercise({
      userId: _id,
      description: description.trim(),
      duration,
      date: date ? new Date(date) : new Date()
    })
    await exercise.save()
    res.json({
      _id: user._id,
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Get user's exercise log (GET /api/users/:_id/logs)
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { _id } = req.params
    const { from, to, limit } = req.query
    const user = await User.findById(_id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    let query = { userId: _id }
    if (from || to) {
      query.date = {}
      if (from && !isNaN(Date.parse(from))) query.date.$gte = new Date(from)
      if (to && !isNaN(Date.parse(to))) query.date.$lte = new Date(to)
    }
    let exercises = await Exercise.find(query)
      .sort({ date: 1 })
      .limit(limit && !isNaN(limit) ? parseInt(limit) : 0)

    const log = Array.isArray(exercises) ? exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: new Date(ex.date).toDateString()
    })) : []

    res.json({
      _id: user._id.toString(),
      username: user.username,
      count: log.length,
      log
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
