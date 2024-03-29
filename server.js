var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
var axios = require("axios");
var cheerio = require("cheerio");
var exphbs = require("express-handlebars")


exphbs.create({
    helpers: {
        'substring': function (string, start, end) {
            var theString = string.substring(start, end);
            // attach dot dot dot if string greater than suggested end point
            if (string.length > end) {
                theString += '...';
            }
            return new exphbs.SafeString(theString);
        }
    }
});

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;

// Initialize Express
var app = express();

// Configure middleware
app.set("view engine", "handlebars");
app.engine("handlebars", exphbs({
    defaultLayout: "main"
}));

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

// Connect to the Mongo DB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/TESTERnewsScraper", {
    useNewUrlParser: true
});

// Routes
app.get("/", function (req, res) {
    db.Article.find({})
        .then(function (dbArticles) {
            // If we were able to successfully find Articles, send them back to the client
            res.render("home", {
                articles: dbArticles
            })
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// A GET route for scraping the echoJS website
app.get("/scrape", function (req, res) {
    var website = "https://opensource.org/news";
    // First, we grab the body of the html with axios
    axios.get(website).then(function (response) {
        mongoose.connection.db.dropDatabase();
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(response.data);

        // Now, we grab every h2 within a header within an article tag, and do the following:
        $("article").each(function (i, element) {
            // Save an empty result object
            var result = {};
            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this)
                .children("header")
                .children("h2")
                .children("a")
                .text();

            result.text = $(this)
                .children("div.content")
                .children("div.field")
                .children("div.field-items")
                .children("div.field-item")
                .children("p")
                .text();

            result.link = (website + $(this)
                .children("header")
                .children("h2")
                .children("a")
                .attr("href"));

            // Create a new Article using the `result` object built from scraping
            db.Article.create(result)
                .then(function (dbArticle) {
                    // View the added result in the console
                })
                .catch(function (err) {
                    // If an error occurred, log it
                    console.log(err);
                });
        });

        // Send a message to the client
        res.redirect("/");
    });
});

// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
    // Grab every document in the Articles collection
    db.Article.find({})
        .then(function (data) {
            // If we were able to successfully find Articles, send them back to the client
            res.json(data);
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});
// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function (req, res) {
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
    db.Article.findOne({
        _id: req.params.id
    })
        // ..and populate all of the notes associated with it
        .populate("note")
        .then(function (dbArticle) {
            // If we were able to successfully find an Article with the given id, send it back to the client
            // res.json(dbArticle);
            // console.log(dbArticle);

            res.render("viewArticle", {
                article: dbArticle
            })
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function (req, res) {
    // Create a new note and pass the req.body to the entry
    db.Note.create(req.body)
        .then(function (dbNote) {
            // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
            // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
            // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
            return db.Article.findOneAndUpdate({
                _id: req.params.id
            }, {
                note: dbNote._id
            }, {
                new: true
            });
        })
        .then(function (dbArticle) {
            // If we were able to successfully update an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});