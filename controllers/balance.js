'use strict'

const mongoose = require('mongoose');
const User = require('../models/user');
const Invest = require('../models/invest');
const service = require('../services');
const moment = require('moment');
const nodemailer = require('nodemailer');
const Ticker = require('../models/ticker');
var _ = require('lodash');
const bitcoin = require('bitcoin');
const Withdraw = require('../models/withdraw');
const Deposit = require('../models/deposit');
const bcrypt = require('bcrypt-nodejs');

var sendpulse = require("sendpulse-api");
var sendpulse = require("../models/sendpulse.js");
var config = require('../config'); 
var speakeasy = require('speakeasy');
const amqp = require('amqplib/callback_api');
var API_USER_ID= 'e0690653db25307c9e049d9eb26e6365';
var API_SECRET= '3d7ebbb8a236cce656f8042248fc536e';
var TOKEN_STORAGE="/tmp/";
const sendRabimq = require('../rabbit_comfim');
const Order = require('../models/order');
sendpulse.init(API_USER_ID,API_SECRET,TOKEN_STORAGE);
const Coinpayments = require('coinpayments');
const ClientCoinpayment = new Coinpayments({
	'key' : config.KeyCoinpayments,
	'secret' : config.SecretCoinpayments
}); 
const WAValidator = require('wallet-address-validator');
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

const BTGclient = new bitcoin.Client({
	host: config.BTG.host,
	port: config.BTG.port,
	user: config.BTG.user,
	pass: config.BTG.pass,
	timeout: config.BTG.timeout
});


function Balance(req,res){
	
	Withdraw.find({'user_id' : req.user._id},(err,result)=>{
		get_pedding_balance(req.user._id,function(data){
			check_pending_deposit(req.user._id,function(check_order){
				res.locals.title = 'Wallet';
				res.locals.menu = 'balance';
				res.locals.user = req.user;
				res.locals.withdraw_history = result;
				res.locals.balance = data;
				res.locals.check_order = check_order;
				res.render('account/balance');
			});
		});	
	});
}

function check_pending_deposit(user_id,callback){
	
	var check_order = {};
	check_order.btc = false;
	check_order.btg = false;
	
	Order.find({$and : [{'user_id' : user_id},{'status' : 0}]},(err,result_order)=>{
		(!err && result_order) && (
			result_order.forEach(function(item){
				if (item.method_payment == 'BTC')
					check_order.btc = true;
				if (item.method_payment == 'BTG')
					check_order.btg = true;
			})
		)
		callback(check_order);
	});
}

function get_pedding_balance(user_id,callback)
{
	var data = {};
	data.coin = 0;
	data.btc = 0;
	data.eth = 0;
	
	Deposit.find({$and : [{'user_id' : user_id}, { 'status': 0 }]},(err,result)=>{
		result.forEach(function(item){
			if (item.type == 'WAVE') data.coin += parseFloat(item.amount);
			if (item.type == 'ETH') data.eth += parseFloat(item.amount);
			if (item.type == 'BTC') data.btc += parseFloat(item.amount);
			
		});
		callback(data);
	});
}

function getWithdraw_user_pendding(req,res){
	Withdraw.find({$and : [{'user_id' : req.user._id}, { 'status': 0 }]},(err,result)=>{
		var new_data_user = [];
		for (var i = result.length - 1; i >= 0; i--) {
			new_data_user.push({
				'date': moment(result[i].date).format('MM/DD/YYYY LT'),
				'amount': (parseFloat(result[i].amount)/100000000).toFixed(8),
				'type': result[i].type,
				'status' : 'Pending',
				'remove_order' : '<button class="remove_order" data-id="'+result[i]._id+'"> <i class="fa fa-times "></i> </button>'

			});
		}
		return res.status(200).send({result: new_data_user});
	});
}

function getDeposit_user_pendding(req,res){
	Deposit.find({$and : [{'user_id' : req.user._id}, { 'status': 0 }]},(err,result)=>{
		var new_data_user = [];
		for (var i = result.length - 1; i >= 0; i--) {
			var status = (result[i].status == 1) ? 'Finish' : 'Cancel';

			var confirms = result[i].type == 'WAVE' ? '/1' : '/3';

			var url_exchain = result[i].txid;
			if (result[i].type == 'BTC')
				url_exchain = '<a target="_blank" href="https://blockchain.info/tx/'+result[i].txid+'" >'+result[i].txid+'</a>';
			if (result[i].type == 'ETH')
				url_exchain = '<a target="_blank" href="https://etherscan.io/tx/'+result[i].txid+'" >'+result[i].txid+'</a>';
			

			new_data_user.push({
				'date': moment(result[i].date).format('MM/DD/YYYY LT'),
				'amount': (parseFloat(result[i].amount)/100000000).toFixed(8),
				'type': result[i].type,
				'confirm' : result[i].confirm+confirms,
				'txid' : url_exchain

			});
		}

		return res.status(200).send({result: new_data_user});
	});
}

function getWithdraw_user_finish(req,res){
	Withdraw.find({$and : [{'user_id' : req.user._id}, {$or: [{ 'status': 1 },{ 'status': 8 }]}]},(err,result)=>{
		var new_data_user = [];
		for (var i = result.length - 1; i >= 0; i--) {
			var status = (result[i].status == 1) ? 'Finish' : 'Cancel';
			new_data_user.push({
				'date': moment(result[i].date).format('MM/DD/YYYY LT'),
				'amount': (parseFloat(result[i].amount)/100000000).toFixed(8),
				'type': result[i].type,
				'status' : status,
				'txid' : result[i].txid

			});
		}

		return res.status(200).send({result: new_data_user});
	});
}

function getDeposit_user_finish(req,res){
	Deposit.find({$and : [{'user_id' : req.user._id}, {$or: [{ 'status': 1 },{ 'status': 8 }]}]},(err,result)=>{
		var new_data_user = [];
		for (var i = result.length - 1; i >= 0; i--) {
			var status = (result[i].status == 1) ? 'Finish' : 'Cancel';

			var url_exchain = result[i].txid;
			if (result[i].type == 'BTC')
				url_exchain = '<a target="_blank" href="https://blockchain.info/tx/'+result[i].txid+'" >'+result[i].txid+'</a>';
			if (result[i].type == 'ETH')
				url_exchain = '<a target="_blank" href="https://etherscan.io/tx/'+result[i].txid+'" >'+result[i].txid+'</a>';
			
			new_data_user.push({
				'date': moment(result[i].date).format('MM/DD/YYYY LT'),
				'amount': (parseFloat(result[i].amount)/100000000).toFixed(8),
				'type': result[i].type,
				'status' : 'Finish',
				'txid' : url_exchain

			});
		}

		return res.status(200).send({result: new_data_user});
	});
}

var get_balance =function(name,user_id,callback){
	var balance = 0;
	User.findOne({'_id' : user_id},(err,data)=>{
		(!err && data)? (
			name === 'BTC' && callback(data.balance.bitcoin_wallet.available),
			name === 'ETH' && callback(data.balance.ethereum_wallet.available),
			name === 'WAVE' && callback(data.balance.coin_wallet.available)
		) : callback (balance) 
	})
}

function get_coin_details(name,callback){
	var data = {};
	if (name === 'BTC') { data.confirmations = 3,  data.free = 100000, data.client = BTCclient };
	if (name === 'ETH') { data.confirmations = 3,  data.free = 100000, data.client =  BTGclient };
	if (name === 'WAVE') { data.confirmations = 3,  data.free = 3000000, data.client =  STCclient };
	callback(data);
}

function check_wallet(type,wallet,callback){
	if (type == 'WAVE')
	{
		STCclient.validateAddress(wallet, function (err, valid) {
			err || !valid.isvalid ? callback(false) : callback(true)
		})
	}
	else
	{
		var valid_address = WAValidator.validate(wallet, type);
		callback(valid_address);
	}

}

function SubmitWithdraw(req,res){

	//return res.status(401).send({ message : 'Error' });

	var address = req.body.address;
	var amount = parseFloat(req.body.amount)*100000000;
	var user = req.user;
	var type = req.body.type;
	if (req.body.token_crt == req.session.token_crt)
	{
		if ( !address)
			return res.status(404).send({message: 'Please enter address wallet '+type+'!'});
		if ( !amount || isNaN(amount) || amount < 0.01)
			return res.status(404).send({message: 'Please enter amount > '+type+'!'});

		if (req.user.security.two_factor_auth.status == 1)
		{
			var verified = speakeasy.totp.verify({
		        secret: user.security.two_factor_auth.code,
		        encoding: 'base32',
		        token: req.body.authenticator
		    });
		    if (!verified) {
		    	return res.status(404).send({ message: 'The two-factor authentication code you specified is incorrect.'});
		    }
		}
			
		get_coin_details(type,function(coin_details){
			get_balance(type,user._id,function(ast_balance){
				if (parseFloat(ast_balance) < parseFloat(amount)+parseFloat(coin_details.free)) 
				{
					return res.status(404).send({error: 'amount', message: 'Ensure wallet has sufficient balance!'});
				}
				else
				{
					var string_sendrabit;


					check_wallet(type,address,function(cb){
						cb ? (
							string_sendrabit = user._id.toString()+'_'+amount.toString()+'_'+address.toString(),
							sendRabimq.publish('','Withdraw_'+type+'_WAVE',new Buffer(string_sendrabit)),
							res.status(200).send({error: '', status: 1, message: 'Withdraw success'})
						) : (
							res.status(404).send({message:'Error Validate Address!'})
						)
					})
				}
			})
		})
	}
}


var update_wallet = function(name ,wallet,user_id,callback){

	var obj = null;
	if (name === 'BTC') obj =  { 'balance.bitcoin_wallet.cryptoaddress': wallet }
	if (name === 'ETH') obj =  {'balance.ethereum_wallet.cryptoaddress' : wallet};
	if (name === 'WAVE') obj = {'balance.coin_wallet.cryptoaddress': wallet};
	User.update({ _id :user_id }, { $set : obj }, function(err, UsersUpdate){
		err ? callback(false) : callback(true);
	});
}
var update_balace = function(name , new_ast_balance,user_id,callback){

	var obj = null;
	if (name === 'BTC') obj =  { 'balance.bitcoin_wallet.available': parseFloat(new_ast_balance) }
	if (name === 'ETH') obj =  {'balance.ethereum_wallet.available' : parseFloat(new_ast_balance)};
	if (name === 'WAVE') obj = {'balance.coin_wallet.available': parseFloat(new_ast_balance)};
	User.update({ _id :user_id }, { $set : obj }, function(err, UsersUpdate){
		err ? callback(false) : callback(true);
	});
}
function get_new_address(Client,name,user,callback){
	var wallet = '';
	if (name === 'BTC') wallet = user.balance.bitcoin_wallet.cryptoaddress;
	if (name === 'ETH') wallet = user.balance.ethereum_wallet.cryptoaddress;
	if (name === 'WAVE') wallet = user.balance.coin_wallet.cryptoaddress;

	wallet === "" ? (
		name == 'WAVE' ? (
			Client.getNewAddress('', function (err, address){
				err || !address ? (
					callback(null)
				) : (
					update_wallet(name,address,user._id,function(cb){
						cb ? callback(address) : callback(null)
					})
				)

			})
		) : (
			ClientCoinpayment.getCallbackAddress(name, function (err, response) {
				update_wallet(name,response.address,user._id,function(cb){
					cb ? callback(response.address) : callback(null)
				})
			})
		)
			
	):(
		callback(wallet)
	)
}


function GetWallet (req,res){
	
	req.body.type ? (
		get_coin_details(req.body.type,function(data){
			get_new_address(data.client,req.body.type,req.user,function(callback){
				callback === null ? (
					res.status(404).send({message:`Can't create new address. Please try again`})
				) : (
					res.status(200).send({ wallet: callback, message: 'Success!' })
				)
			})	
		})
	) : res.status(404).send({message:`Can't create new address. Please try again`})
}

function create_token(req,res){
	var token_withdraw = _.replace(bcrypt.hashSync(new Date(), bcrypt.genSaltSync(8), null),'?','_');
	req.session.token_crt = token_withdraw;	
	return res.status(200).send({'token': token_withdraw});				
}

function Remove_Withdraw (req,res){
	var user = req.user;
	var string_sendrabit = req.body.id;
	sendRabimq.publish('','Remove_Withdraw_WAVE',new Buffer(string_sendrabit));
	return res.status(200).send({ message: 'Success' });
}


function CallbackCoinpayment(req,res){
	
	var tx = req.body.txn_id;
	var address = req.body.address;
	var amount = req.body.amount;
	var currency = req.body.currency;
	if (tx)
	{
		Deposit.findOne({'txid' : tx},function(err,result){
			if (!err && !result)
			{
				var string_sendrabit = tx.toString()+'_'+address.toString()+'_'+amount.toString()+'_'+currency.toString();
				sendRabimq.publish('','Deposit',new Buffer(string_sendrabit));
			}
			return res.status(200).send('Deposit');
		});
	}
	else
	{
		return res.status(200).send('Deposit');
	}	
	
}


module.exports = {
	Balance,
	SubmitWithdraw,
	GetWallet,
	getWithdraw_user_pendding,
	getDeposit_user_pendding,
	getWithdraw_user_finish,
	getDeposit_user_finish,
	Remove_Withdraw,
	create_token,
	CallbackCoinpayment
}