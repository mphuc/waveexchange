'use strict'

const mongoose = require('mongoose');
const User = require('../models/user');
const service = require('../services');
const Ticker = require('../models/ticker');
const Order = require('../models/order');
function IndexOn(req,res){
	// setupTicker();
	
	res.locals.title = 'Dashboard'
	res.locals.menu = 'dashboard'
	res.locals.user = req.user
	res.render('account/dashboard');
}

function setupTicker(){
	let newTicker = new Ticker();
	newTicker.last= '0.5';
	newTicker.bid= '0.5';
	newTicker.ask= '0.5';
	newTicker.high= '0.5';
	newTicker.volume= '0.5';
	newTicker.price_usd= '0.5';
	newTicker.price_btc= '0.5';
	newTicker.save((err, investStored)=>{
		console.log(investStored);
	});
}


function TransferToCoin(req, res){
	var amountUsd = parseFloat(req.body.amount);
	
	var user = req.user;
	var balance_lending = parseFloat(user.balance.lending_wallet.available).toFixed(8);
	var balance_coin = parseFloat(user.balance.coin_wallet.available).toFixed(8);
	
	
	if ( amountUsd < 5 || amountUsd > balance_lending || isNaN(amountUsd))
		return res.status(404).send({message: 'Please enter amount > 5$!'})

	Ticker.findOne({},(err,data_ticker)=>{
		if(err){
			res.status(500).send({message: `Error al crear el usuario: ${err}`})
		}else{
			amountUsd = parseFloat(amountUsd).toFixed(8);
			var ast_usd = data_ticker.price_usd;
			var amount = parseFloat(amountUsd)/ parseFloat(ast_usd);
			amount = parseFloat(amount).toFixed(8);
			var query = {_id:user._id};
			var new_balance_lending = parseFloat(balance_lending) - parseFloat(amountUsd);
			new_balance_lending = parseFloat(new_balance_lending).toFixed(8);
			var new_balance_coin = parseFloat(balance_coin) + parseFloat(amount);
			new_balance_coin = parseFloat(new_balance_coin).toFixed(8);
			var data_update = {
				$set : {
					'balance.lending_wallet.available': parseFloat(new_balance_lending),
					'balance.coin_wallet.available': parseFloat(new_balance_coin)
				},
				$push: {
					'balance.lending_wallet.history': {
						date: Date.now(), 
						type: 'sent', 
						amount: parseFloat(amountUsd), 
						detail: 'Transfer to BBL wallet  $' +parseFloat(amountUsd) + ' ('+ parseFloat(amount)+' BBL) <br> Exchange rate: 1 BBL = '+parseFloat(ast_usd)+' USD'
					},
					'balance.coin_wallet.history': {
						date: Date.now(), 
						type: 'received', 
						amount: parseFloat(amount), 
						detail: 'Received from USD wallet $' +parseFloat(amountUsd) + ' ('+ parseFloat(amount)+' BBL) <br> Exchange rate: 1 BBL = '+parseFloat(ast_usd)+' USD'
					}
				}
			};

			User.update(query, data_update, function(err, Users){
				if(err) res.status(500).send({message: `Error al crear el usuario: ${err}`})
				return res.status(200).send({
					message: 'Transfer success', 
					balance_lending: parseFloat(new_balance_lending),
					balance_coin: parseFloat(new_balance_coin)
				}) /*service son como helpers*/
			});
		} 
		

	});

	
}

module.exports = {
	IndexOn,
	TransferToCoin
}