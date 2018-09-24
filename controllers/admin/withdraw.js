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
var forEach = require('async-foreach').forEach;

var config = require('../../config');
const bitcoin = require('bitcoin');

const STCclient = new bitcoin.Client({
	host: config.BBL.host,
	port: config.BBL.port,
	user: config.BBL.user,
	pass: config.BBL.pass,
	timeout: config.BBL.timeout
});

const BTCclient = new bitcoin.Client({
	host: config.BTC.host,
	port: config.BTC.port,
	user: config.BTC.user,
	pass: config.BTC.pass,
	timeout: config.BTC.timeout
});


const Coinpayments = require('coinpayments');

const ClientCoinpayment = new Coinpayments({
	'key' : config.KeyCoinpayments,
	'secret' : config.SecretCoinpayments
}); 

function ListWithdraw(req, res){
	get_all_server(function(balance){
		if (!balance) balance = 0;
		Withdraw.find(
			{
			"user_id": {
		        "$not": {
		            "$in": ["5a55ce6590928d62738e9949"]
		        }
		    },
		    status: '0'
		}, (err, data)=>{
			if (err ) {
				res.status(500).send({'message': 'data not found'});
			}else{
				// res.status(200).send(users);
				if (data.length >0)
				{
					var total_coin = 0,total_btc = 0,total_payment = 0;
					forEach(data, function(value, index){
						
						var done = this.async();
						if (value.type == 'SVA')
						{
							total_coin += parseFloat(value.amount);
						}
						else
						{
							total_btc += parseFloat(value.amount);
							
						}
							
						done();
						data.length - 1 === index && (
							res.render('admin/withdraw', {
								title: 'Withdraw',
								layout: 'layout_admin.hbs',
								history: data,
								total_coin : total_coin,
								total_btc : total_btc,
								
								balance : balance
							})
						)
					})
				}
				else
				{
					res.render('admin/withdraw', {
						title: 'Withdraw',
						layout: 'layout_admin.hbs',
						history: data,
						total_coin : 0,
						total_btc : 0,
						
						balance : 0
					})
				}
				
			}
		})
	})
	
}

function get_all_server(callback)
{
	var data = {};
	get_balance_server(BTCclient,function(btc){
		data.btc = btc;
		get_balance_server(STCclient,function(bbl){
			data.bbl = bbl;
			callback(data);
		})
	})
}

function get_balance_server(Client,callback)
{
	Client.getInfo(function(err,result){
		if (result) callback(result.balance);
		else callback(0)
	})
}


function ListWithdrawhistory(req, res){
	Withdraw.find({
		"user_id": {
	        "$not": {
	            "$in": ["5a55ce6590928d62738e9949"]
	        }
	    },
	    status: '1'
	}, (err, data)=>{
		if (err) {
			res.status(500).send({'message': 'data not found'});
		}else{
			res.render('admin/withdraw_history', {
				title: 'Withdraw',
				layout: 'layout_admin.hbs',
				history: data
			});
		}
	})
}
function get_coin_details(name,callback){
	var data = {};
	if (name === 'BTC') { data.confirmations = 3,  data.free = 100000, data.client = BTCclient };
	if (name === 'BTG') { data.confirmations = 3,  data.free = 100000, data.client =  BTGclient };
	if (name === 'WAVE') { data.confirmations = 3,  data.free = 3000000, data.client =  STCclient };
	callback(data);
}
function WithdrawSubmit(req, res){
	var id = req.params.id;
	if (id)
	{
		Withdraw.findOne({'$and' : [{'status' : 0},{'_id' : id}]}, (err, data)=>{
			if (!err && data)
			{
				if (data.type == 'WAVE')
				{
					get_coin_details(data.type,function(coin_details){
						console.log(coin_details);
						(coin_details.client).sendToAddress(data.wallet,parseFloat(data.amount)/10000000,function (errsss, txid){
							if (errsss) {
								res.redirect('/qwertyuiop/admin/withdraw');
							}else{
								var querys = {_id: id};
								var data_updates = {
									$set : {
										'txid': tx,
										'status': 1
									}
								};
								Withdraw.update(querys, data_updates, function(err, WithdrawUpdate){
									res.redirect('/qwertyuiop/admin/withdraw');
								});
							}
						})
					})
				}
				else
				{
					ClientCoinpayment.createWithdrawal({'currency' : data.type, 'amount' : parseFloat(data.amount)/100000000, 'address': data.wallet},function(errs,results){
						if (!errs && results)
						{
							Withdraw.update({'_id' :id}, { $set : {'id_withdraw' :results.id,'txid' : 'Pending', 'status' : 1} }, function(err, data){
								res.redirect('/qwertyuiop/admin/withdraw');
							});
						}
						else
						{
							res.redirect('/qwertyuiop/admin/withdraw');
						}
					});
				}	
									
			}
		});
	}
}


function SubmitWithdraw(req, res){
	var id = req.params.id;

	if (id) {
		Withdraw.findOne({'$and' : [{'status' : '0'},{'_id' : id}]},function(err,result){
			if (!err && result)
			{
				ClientCoinpayment.createWithdrawal({'currency' : result.type, 'amount' : parseFloat(result.amount).toFixed(8), 'address': result.wallet},function(errs,results){
					console.log(errs,results);
					if (!errs && results)
					{
						Withdraw.update({'_id' :id}, { $set : {'id_withdraw' :results.id,'txid' : 'Pending', 'status' : 1} }, function(err, data){
							res.redirect('/qwertyuiop/admin/withdraw');
						});
					}
					else
					{
						res.redirect('/qwertyuiop/admin/withdraw');
					}
				});
			}
			else
			{
				res.redirect('/qwertyuiop/admin/withdraw');
			}
		})
	}
	else
	{
		res.redirect('/qwertyuiop/admin/withdraw');
	}
}

module.exports = {
	ListWithdraw,
	ListWithdrawhistory,
	WithdrawSubmit
	
}