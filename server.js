var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var mongoose = require('mongoose');
var User = require('./Users');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var Review = require('./Reviews');
var Movie = require('./Movies');

var app = express();
module.exports = app; // for testing
app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);

            var userJson = JSON.stringify(user);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {
    var userNew = new User();
    //userNew.name = req.body.name;
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        user.comparePassword(userNew.password, function(isMatch){
            if (isMatch) {
                var userToken = {id: user._id, username: user.username};
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, message: 'Authentication failed.'});
            }
        });
    });
});

router.route('/movies')
    .post(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);
        var movie = new Movie();
        movie.title = req.body.title;
        movie.yearReleased = req.body.yearReleased;
        movie.genre = req.body.genre;
        movie.actors = req.body.actors;
        // save the movie
        if (Movie.findOne({title: movie.title}) != null) {
            movie.save(function (err) {
                if (err) {
                    // duplicate entry
                    if (err.code == 11000)
                        res.json({success: false, message: 'A movie with that name already exists. '});
                    else
                        return res.send(err);
                }else res.json({success: true, message: 'Movie created!'});
            });
        };
    })

    .delete(authJwtController.isAuthenticated, function (req, res) {
        Movie.deleteOne({title: req.body.title}, function(err, obj) {
            if (err) res.send(err);
            else res.json({success: true, message: 'Movie deleted!'});
        })
    })

    .put(authJwtController.isAuthenticated, function (req, res) {
        var qtitle = req.query.title;
        if (Movie.findOne({title: qtitle}) != null) {
            var newVals = { $set: req.body };
            Movie.updateOne({title: qtitle}, newVals, function(err, obj) {
                if (err) res.send(err);
                else res.json({success: true, message: 'Movie updated!'});
            })
        };
    })

    .get(authJwtController.isAuthenticated, function (req, res) {
        if (req.query.reviews == "true") {
            Movie.aggregate()
                .match(req.body)

                .lookup({
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'movieID',
                    as: 'reviews'
                })

                .exec(function (err, movie) {
                    if (err) return res.send(err);
                    if (movie && movie.length > 0) {
                        // Add avgRating
                        for (let j = 0; j < movie.length; j++) {
                            let total = 0;
                            for (let i = 0; i < movie[j].reviews.length; i++) {
                                total += movie[j].reviews[i].rating;
                            }
                            if (movie[j].reviews.length > 0) {
                                movie[j] = Object.assign({}, movie[j],
                                    {avgRating: (total/movie[j].reviews.length).toFixed(1)});
                            }
                        }
                        movie.sort((a,b) => {
                            return b.avgRating - a.avgRating;
                        });
                        return res.status(200).json({
                            success: true,
                            result: movie
                        });
                    }

                    else return res.status(400).json({ success: false, message: "Movie not found."});
                })
        }

        else {
            Movie.find(function (err, movie) {
                if (err)
                    res.send(err);
                else res.json(movie);
            })
        }
    });

router.route('/movies/:movieId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        if (req.query.reviews == "true") {
            var id = req.params.movieId;

            Movie.aggregate()
                .match({
                    _id: mongoose.Types.ObjectId(id
                    )})

                .lookup({
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'movieID',
                    as: 'reviews'
                })

                .exec(function (err, movie) {
                    if (err) return res.send(err);
                    if (movie && movie.length > 0) {
                        // Add avgRating
                        for (let j = 0; j < movie.length; j++) {
                            let total = 0;
                            for (let i = 0; i < movie[j].reviews.length; i++) {
                                total += movie[j].reviews[i].rating;
                            }
                            if (movie[j].reviews.length > 0) {
                                movie[j] = Object.assign({}, movie[j],
                                    {avgRating: (total/movie[j].reviews.length).toFixed(1)});
                            }
                        }
                        movie.sort((a,b) => {
                            return b.avgRating - a.avgRating;
                        });
                        return res.status(200).json({
                            success: true,
                            result: movie
                        });
                    }
                    else return res.status(400).json({ success: false, message: "Movie not found."});
                })

        }

        else {
            var id = req.params.movieId;
            Movie.findById(id, function(err, movie) {
                if (err) res.send(err);
                if (movie) {
                    res.status(200).send({ success: true, result: movie });
                }
                else {
                    res.status(400).send({ success: false, message: "Movie not found" });
                }
            });
        }
    });

router.route('/reviews')
    .post(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);

        var id = req.body.movieID
        Movie.findById(id, function (err, movie) {
            if (err) res.json({message: "Movie does not exist"});

            else {
                if (!req.body.name || !req.body.quote || !req.body.rating || !req.body.movieID) {
                res.status(400).send({success: false, message: 'Missing values'})
                }

                else {
                    var review = new Review();
                    review.name = req.body.name
                    review.quote = req.body.quote
                    review.rating = req.body.rating
                    review.movieID = req.body.movieID

                    review.save(function (err) {
                        if (err) {
                            // duplicate entry
                            if (err.code == 11000)
                                res.json({
                                    success: false,
                                    message: 'A review for this movie and name already exists. '
                                });
                            else
                                return res.send(err);
                        } else res.json({success: true, message: 'Review created!'});
                    });
                }
            }
        });
    });


app.use('/', router);
app.listen(process.env.PORT || 8080);
