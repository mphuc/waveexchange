'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const Depositchema = new Schema({
	user_id : String,
	amount : String,
	confirm : String,
	username : String,
	wallet : String,
	txid : String,
	date: { type: Date, default: Date.now() },
	type : String,
	status : { type: Number, default: 0}
	
});



var Deposit = mongoose.model('Deposit', Depositchema);
module.exports = Deposit;