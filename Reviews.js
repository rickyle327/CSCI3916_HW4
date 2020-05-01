var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

mongoose.connect(process.env.DB, { useNewUrlParser: true } );
mongoose.set('useCreateIndex', true);

var ReviewSchema = new Schema({
    name: { type: String, required: true },
    review: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    movieID: { type: mongoose.Types.ObjectId, required: true }
});

ReviewSchema.index({ name: 1, movieID: 1}, {unique: true})

module.exports = mongoose.model('Review', ReviewSchema);