'use strict'

const User = require('../../models/user');
const Withdraw = require('../../models/withdraw');
const Ticker = require('../../models/ticker');
const Invest = require('../../models/invest');
const IcoSum = require('../../models/icosum');
const Ico = require('../../models/ico');
const moment = require('moment');
const speakeasy = require('speakeasy');
const _ = require('lodash');
const Deposit = require('../../models/deposit');
function ListDeposit(req, res){
	Deposit.find({
		"user_id": {
	        "$not": {
	            "$in": ["5a55ce6590928d62738e9949"]
	        }
	    }
	}, (err, data)=>{
		if (err) {
			res.status(500).send({'message': 'data not found'});
		}else{
			
			res.render('admin/deposit', {
				title: 'Deposit',
				layout: 'layout_admin.hbs',
				history: data
			});
		}
	})
}



module.exports = {
	ListDeposit
}