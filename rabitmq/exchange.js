'use strict'
const mongoose = require('mongoose');
const User = require('../models/user');
const service = require('../services');
const moment = require('moment');
const bitcoin = require('bitcoin');
var config = require('../config');
const request = require('request');
const speakeasy = require('speakeasy');
const _ = require('lodash');
const bcrypt = require('bcrypt-nodejs');
const urlSlug = require('url-slug');
var sendpulse = require("sendpulse-api");
const OrderBuy = require('../models/exchange/orderbuy').module();
const OrderSell = require('../models/exchange/ordersell').module();
const MarketHistory = require('../models/exchange/markethistory').module();
const Volume = require('../models/exchange/volume').module();
var forEach = require('async-foreach').forEach;

var info = {
    socket: null,
    io: null,
    get sockets() {
        return {
        	socket : this.socket,
        	io : this.io
        };
    },
    set sockets (infoSocket) {
        this.socket = infoSocket[0] || null;
        this.io = infoSocket[1] || null;
    }
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
var update_balace = function(name , new_ast_balance,user_id,callback){

	var obj = null;
	if (name === 'BTC') obj =  { 'balance.bitcoin_wallet.available': parseFloat(new_ast_balance) }
	if (name === 'WAVE') obj = {'balance.coin_wallet.available': parseFloat(new_ast_balance)};
	if (name === 'ETH') obj = {'balance.ethereum_wallet.available': parseFloat(new_ast_balance)};
	User.update({ _id :user_id }, { $set : obj }, function(err, UsersUpdate){
		err ? callback(false) : callback(true);
	});
}

var newOrderBuy = function(user_id, MarketName,quantity,price, subtotal, commission ,total){
	var today = moment();
	return new OrderBuy({
		"user_id" : user_id,
		"MarketName" : MarketName,
		"quantity" : parseFloat(quantity).toFixed(8),
		"price" : parseFloat(price).toFixed(8),
		"subtotal" : parseFloat(subtotal).toFixed(8),
		"commission" : parseFloat(commission).toFixed(8),
		"total" : parseFloat(total).toFixed(8),
		"date" : moment(today).format(),
		"status" : 0
	})
}	


var newOrderSell = function(user_id, MarketName,quantity,price, subtotal, commission ,total){
	var today = moment();
	return new OrderSell({
		"user_id" : user_id,
		"MarketName" : MarketName,
		"quantity" : parseFloat(quantity).toFixed(8),
		"price" : parseFloat(price).toFixed(8),
		"subtotal" : parseFloat(subtotal).toFixed(8),
		"commission" : parseFloat(commission).toFixed(8),
		"total" : parseFloat(total).toFixed(8),
		"date" : moment(today).format(),
		"status" : 0
	})
}

var UpdateVolume = function(data,MarketName,Last,hight,low,bid,ask,volume){
	//data,MarketName,-1,-1,-1,-1,ask,-1
	var query = {'_id' : data._id};
	var date_update;
	parseFloat(Last) > 0 && (
		date_update = {
			'last' : Last,
			'hight' : hight,
			'low' : low,
			'volume' : volume,
			'last_last' : data.last,
			'hight_last' : data.hight,
			'low_last' : data.low,
			'volume_last' : data.volume
		}
	);
	parseFloat(bid) > 0 && (
		date_update = {
			'bid' : bid,
			'bid_last' : data.bid
		}
	);
	parseFloat(ask) > 0 && (
		date_update = {
			'ask' : ask,
			'ask_last' : data.ask
		}
	);
	Volume.update(query,date_update,function(err,result){})
}


function update_volume(MarketName,Last,Bid,Ask,Volum){
	console.log(MarketName,Last,Bid,Ask,Volum);
	Volume.findOne({'MarketName' : MarketName},function(err,data){

		if (data)
		{
			parseFloat(Bid) > 0 && (
				OrderBuy.find({ $and : [{"MarketName" : MarketName},{"status" : "0"}]},
				function(errbuy,result_buyorder){
					Sortobject_buy(result_buyorder,function(max_buyorder){
						//var bid = Bid;//result_buyorder.length > 0 ? Bid : 0;
						var bid = result_buyorder.length > 0 ? max_buyorder[0].price : 0;
						UpdateVolume(data,MarketName,-1,-1,-1,bid,-1,-1);
					})
				})
			),
			parseFloat(Ask) > 0 &&(
				OrderSell.find({ $and : [{"MarketName" : MarketName},{"status" : "0"}]},
				function(errsell,result_sellorder){
					Sortobject_sell(result_sellorder,function(max_sellorder){
						var ask = result_sellorder.length > 0 ? max_sellorder[0].price : 0;
						UpdateVolume(data,MarketName,-1,-1,-1,-1,ask,-1);
					})
				})
			),
			parseFloat(Last) > 0 && (
				MarketHistory.find(
					{ $and : [{"MarketName" : MarketName},
					{
					    "date": 
					    {
					        $gte: new Date((new Date().getTime() - (15 * 24 * 60 * 1000)))
					    }
					}]
				},
				function(errs,result){
					Sortobject_buy(result,function(max_vol){
						Sortobject_sell(result,function(min_vol){
							if (result ){
								var total_volume = 0;
								for (var sss = result.length - 1; sss >= 0; sss--) 
								{
									total_volume +=  parseFloat(result[sss].total);
								}
							}
							var hight = result.length > 0 ? max_vol[0].price : data.hight;
							var low = result.length > 0 ? min_vol[0].price : data.low;
							UpdateVolume(data,MarketName,Last,hight,low,-1,-1,total_volume);
						})
					})
				})
			)
		}
	})
}

function process_sell(string_receiverabit,callback){
	var build_String = string_receiverabit.split("_");
	var MarketExchange = build_String[0];
	var quantity_Sell = build_String[1];
	var price_Sell = build_String[2];
	var user_id = build_String[3];
	
	var fee = 0.9975;
    
    var total = parseFloat(quantity_Sell*price_Sell*fee);
    var total_not_fee = parseFloat(quantity_Sell*price_Sell);
    var subtotal = parseFloat(quantity_Sell*price_Sell);
    var commission = parseFloat(quantity_Sell*price_Sell*0.0025);

    

	get_balance(MarketExchange.split('-')[1],user_id,function(balance){
		if (parseFloat(balance) >= total*100000000)
        {
        	newOrderSell(user_id, MarketExchange,(quantity_Sell*100000000).toFixed(8),(price_Sell*100000000).toFixed(8), (subtotal*100000000).toFixed(8), (commission*100000000).toFixed(8), (total_not_fee*100000000).toFixed(8)).save(( err,order_create)=>{
        		var new_ast_balance;
				
				err ? callback(false) : (
					new_ast_balance = (parseFloat(balance) - quantity_Sell*100000000).toFixed(8),
					update_balace(MarketExchange.split('-')[1],new_ast_balance,user_id,function(cb){
						
						cb ? (matching_buy(order_create) , callback (true)) : callback (false)
					})
				)
			})
        }
        else
        {
        	callback(false)
        }
	});
}

function process_buy(string_receiverabit,callback){
	var build_String = string_receiverabit.split("_");
	var MarketExchange = build_String[0];
	var quantity_Buy = build_String[1];
	var price_Buy = build_String[2];
	var user_id = build_String[3];
	
	var fee = 1.0025;
	
    var total = parseFloat(quantity_Buy*price_Buy*fee);
    var total_not_fee = parseFloat(quantity_Buy*price_Buy);
    var subtotal = parseFloat(quantity_Buy*price_Buy);
    var commission = parseFloat(quantity_Buy*price_Buy*0.0025);

	get_balance(MarketExchange.split('-')[0],user_id,function(balance){
		if (parseFloat(balance) >= total*100000000)
        {
        	newOrderBuy(user_id, MarketExchange,(quantity_Buy*100000000).toFixed(8),(price_Buy*100000000).toFixed(8), (subtotal*100000000).toFixed(8), (commission*100000000).toFixed(8), (total_not_fee*100000000).toFixed(8)).save(( err, order_create)=>{
        		var new_ast_balance;
				err ? callback(false) : (
					new_ast_balance = (parseFloat(balance) - total*100000000).toFixed(8),
					update_balace(MarketExchange.split('-')[0],new_ast_balance,user_id,function(cb){
						cb ? (
							matching_sell(order_create),
							callback (true)
						) : callback (false)
					})
				)
			})
        }
        else
        {
        	callback(false)
        }
	});
}

function process_cancel_order(string_receiverabit,callback){
	var build_String = string_receiverabit.split("_");

	var id_order = build_String[0];
	var tpyes = build_String[1];
	var user_id = build_String[2];
	if (tpyes == 'Sell')
	{
		OrderSell.findOne({ $and : [{_id : id_order},{user_id : user_id},{status : 0}]},(err,data)=>{
			var query;
			var data_update;
			err || !data ? (
				callback(false)
			) :
			(
				query = {'_id':id_order},
				data_update = {
					$set : {
						'status': 8
					}
				},
				OrderSell.findOneAndRemove(query, function(err, Users){
					var wallet_name =  data.MarketName.split("-")[1];
					var value_update = data.quantity;
					!err ? (
						get_balance(wallet_name,user_id,function(ast_balance){
							var new_ast_balance = (parseFloat(ast_balance) + parseFloat(value_update) ).toFixed(8);
							update_balace(wallet_name , new_ast_balance,user_id,function(cb){
								update_volume(data.MarketName,-1,-1,data.price,-1);
								cb ? (callback(true),Users.remove()) : callback(false)
							})
						})
					) : callback(false)
				})
			)
		});
	}
	else
	{
		OrderBuy.findOne({ $and : [{_id : id_order},{user_id : user_id},{status : 0}]},(err,data)=>{
			var query;
			
			err || !data ? (
				callback(false)
			) :
			(
				query = {'_id':id_order},
				
				OrderBuy.findOneAndRemove(query, function(err, Users){
					var wallet_name = data.MarketName.split("-")[0];
					var value_update = (data.total)*1.0025;
					
					!err ? (
						get_balance(wallet_name,user_id,function(ast_balance){
							var new_ast_balance = (parseFloat(ast_balance) + parseFloat(value_update) ).toFixed(8);
							update_balace(wallet_name , new_ast_balance,user_id,function(cb){

								update_volume(data.MarketName,-1,data.price,-1,-1);

								cb ? (Users.remove(),callback(true)) : callback(false)
							})
						})
					) : callback(false)
				})
			)
		});
	}
}

var newMarketHistory = function(user_id_buy,user_id_sell, MarketName,price,quantity,total,type ){



	var today = moment();
	return new MarketHistory({
		"user_id_buy" : user_id_buy,
		"user_id_sell" : user_id_sell,
		"MarketName" : MarketName,
		"price" : price,
		"quantity" : quantity,
		"total" : total,
		"date" : moment(today).format(),
		"status" : 0,
		"type" : type
	})
}	
function Create_market(user_id_buy,user_id_sell,MarketName,quantity,price,type,callback){
	

	var total = parseFloat(price)*parseFloat(quantity)*1.0025/100000000;
	newMarketHistory(
		user_id_buy,
		user_id_sell, 
		MarketName,
		parseFloat(price),
		parseFloat(quantity),
		total, 
		type
	).save(( err, DepositStored)=>{
		!err && callback(true);
	})
}



function finish_orderbuy(id,status,callback){
	OrderBuy.update({ _id :id }, { $set : {'status' : status} }, function(err, UsersUpdate){
		err ? callback(false) : callback(true);
	});
}
/*setTimeout(function() {
	matching_buy("5a37a9475597a230926eb54f");
}, 12000);*/


function Sortobject_buy(object,callback){
	callback(_.sortBy(object, [function(o) { return parseFloat(o.price); }]).reverse());
}
function Sortobject_sell(object,callback){
	callback(_.sortBy(object, [function(o) { return parseFloat(o.price); }]));
}



function matching_buy(sellorder){	
	var today_date = moment();
	var now_date = moment(today_date).format();
	OrderBuy.find({$and : 
		[
            {$where: 'this.price >= '+parseFloat(sellorder.price)+''},
            {'MarketName' : sellorder.MarketName },
            {'status' : 0}
        ]
	}
	,function(err,buyorder){
		!err && buyorder.length > 0 ? (
			Sortobject_buy(buyorder,function(buyorder){
				var quantity_Sell;
				var array_push_market = [];
				var array_remove_buy = [];
				var array_remove_sell = [];
				var array_push_alls = [];
				var soketss = false;
				buyorder && (
					quantity_Sell = parseFloat(sellorder.quantity),
					forEach(buyorder, function(item, index){
						var done = this.async();
						
						//console.log(parseFloat(quantity_Sell),parseFloat(item.quantity));
						if (parseFloat(quantity_Sell).toFixed(8) > parseFloat(item.quantity).toFixed(8) && parseFloat(quantity_Sell).toFixed(8) > 0){
							console.log(">>>>>>>>>>>>>>>>>>");
							array_push_market.push([item.user_id, sellorder.user_id, sellorder.MarketName, item.quantity, item.price, 'Sell',now_date])
							Create_market(
								item.user_id,
								sellorder.user_id,
								sellorder.MarketName,
								item.quantity,
								item.price,
								'Sell',
							function(cbb){
								var query;
								var data_update;
								var string_sendrabit;
								cbb && (
									OrderBuy.findOneAndUpdate({'_id' : item._id},{'status' : 1},function(errs,result_rm){
										quantity_Sell = parseFloat(quantity_Sell).toFixed(8) - parseFloat(item.quantity).toFixed(8),

										get_balance(sellorder.MarketName.split("-")[0],sellorder.user_id,function(balance_sell){
											var new_balance_sell = (parseFloat(balance_sell) + (parseFloat(item.quantity)*parseFloat(item.price)/100000000*0.9975)).toFixed(8);
											
											update_balace(sellorder.MarketName.split("-")[0],new_balance_sell,sellorder.user_id,function(cbsss){
												get_balance(sellorder.MarketName.split("-")[1],item.user_id,function(balance_buy){
													var new_balance_buy = (parseFloat(balance_buy) + parseFloat(item.quantity)).toFixed(8);
													update_balace(sellorder.MarketName.split("-")[1],new_balance_buy,item.user_id,function(cbsss){
														
													})
												})
											})
										}),

										(buyorder.length - 1 === index && parseFloat(quantity_Sell) > 0) && 
										(
											query = {'_id' : sellorder._id},
											data_update = {
												quantity : parseFloat(quantity_Sell).toFixed(8),
												total : (parseFloat(quantity_Sell)*parseFloat(item.price)/100000000).toFixed(8),
												price : item.price
											},
											OrderSell.update(query,data_update,function(errrs,result_ud){
												//console.log(result_ud)
											})
										),
										
										array_remove_buy.push(result_rm),
										array_remove_sell.push({
											quantity : parseFloat(item.quantity),
											total : (parseFloat(item.quantity)*parseFloat(item.price)/100000000).toFixed(8),
											price : item.price,
											_id : sellorder._id
										}),
										setTimeout(function() {
											//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', result_rm);
											done()
										}, 100);
									})
									
								)
							})
						} 
						else if (parseFloat(quantity_Sell).toFixed(8) == parseFloat(item.quantity).toFixed(8) && parseFloat(quantity_Sell).toFixed(8) > 0)
						{
							
							console.log("=====================");
							array_push_market.push([item.user_id, sellorder.user_id, sellorder.MarketName, item.quantity, item.price, 'Sell',now_date]);
							Create_market(
								item.user_id,
								sellorder.user_id,
								sellorder.MarketName,
								item.quantity,
								item.price,
								'Sell',
							function(cbb){
								cbb && (
									OrderSell.findOneAndUpdate({'_id' : sellorder._id},{'status' : 1},function(errs,result_ssss){
										OrderBuy.findOneAndUpdate({'_id' : item._id},{'status' : 1},function(errs,result_rm){
											quantity_Sell = parseFloat(quantity_Sell) - parseFloat(item.quantity),
											get_balance(sellorder.MarketName.split("-")[0],sellorder.user_id,function(balance_sell){
												var new_balance_sell = (parseFloat(balance_sell) + parseFloat(item.total)*0.9975).toFixed(8);
												
												update_balace(sellorder.MarketName.split("-")[0],new_balance_sell,sellorder.user_id,function(cbsss){
													get_balance(sellorder.MarketName.split("-")[1],item.user_id,function(balance_buy){
														var new_balance_buy = (parseFloat(balance_buy) + parseFloat(item.quantity)).toFixed(8);
														update_balace(sellorder.MarketName.split("-")[1],new_balance_buy,item.user_id,function(cbsss){
															
														})
													})
												})
											}),

											array_remove_buy.push(result_rm),
											array_remove_sell.push(sellorder),

											setTimeout(function() {
												//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', result_rm);
												//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', sellorder);
												done()
											}, 100);
										})
									})
								)
							});
						}
						else if (parseFloat(quantity_Sell).toFixed(8) < parseFloat(item.quantity).toFixed(8) && parseFloat(quantity_Sell).toFixed(8) > 0)
						{
							console.log("<<<<<<<<<<<<<<<<<");
							array_push_market.push([item.user_id, sellorder.user_id, sellorder.MarketName, quantity_Sell, item.price, 'Sell',now_date]);
							Create_market(
								item.user_id,
								sellorder.user_id,
								sellorder.MarketName,
								quantity_Sell,
								item.price,
								'Sell',
							function(cbb){
								var query_ud;
								var data_ud;
								cbb && (
									OrderSell.findOneAndUpdate({'_id' : sellorder._id},{'status' : 1},function(errs,result_ssss){
										OrderBuy.update({'_id' : item._id},{'status' : 1},function(errs,result_rm){

											//console.log(parseFloat(item.quantity),parseFloat(quantity_Sell),"123123213");

											var quantity_sub = parseFloat(item.quantity).toFixed(8) - parseFloat(quantity_Sell).toFixed(8);

											var quantitysss = quantity_sub;
											var totalsss = (quantity_sub*parseFloat(item.price)/100000000).toFixed(8);
											var subtotalsss = quantitysss*parseFloat(item.price)/100000000;
											var commissionsss = quantitysss*parseFloat(item.price)/100000000*0.0025;
											var balance_add;
											var amount_add_quanty;
											newOrderBuy(item.user_id, item.MarketName,quantitysss,item.price, subtotalsss, commissionsss,totalsss).save(( err, DepositStored)=>{
												!err &&  (
													balance_add = (parseFloat(quantity_Sell)*parseFloat(item.price)/100000000).toFixed(8),
													amount_add_quanty = quantity_Sell,
													quantity_Sell = parseFloat(quantity_Sell) - parseFloat(item.quantity),
													get_balance(sellorder.MarketName.split("-")[0],sellorder.user_id,function(balance_sell){		
														//console.log(balance_add,balance_sell);
														var new_balance_sell = (parseFloat(balance_sell) + (balance_add*0.9975)).toFixed(8);
														
														update_balace(sellorder.MarketName.split("-")[0],new_balance_sell,sellorder.user_id,function(cbsss){
															
															get_balance(sellorder.MarketName.split("-")[1],item.user_id,function(balance_buy){
																var new_balance_buy = (parseFloat(balance_buy) +  parseFloat(amount_add_quanty)).toFixed(8);
																update_balace(sellorder.MarketName.split("-")[1],new_balance_buy,item.user_id,function(cbsss){
																		
																})
															})
														})
													}),

													array_remove_buy.push(item),
													array_remove_sell.push(sellorder),
													soketss = true,
													setTimeout(function() {
														//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', item);
														//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', sellorder);
														done()
													}, 100)
												)
											})
										})
									})
								)
							});
						}


						(buyorder.length - 1 === index || soketss == true) && (

							setTimeout(function() {

								array_push_alls.push({
									'OrderBuy_remove' : array_remove_buy,
									'OrderSell_remove' : array_remove_sell,
									'MatchingOrder' : array_push_market
								});


								info.sockets.socket.broadcast.emit('Buy_Sell_Matching', array_push_alls),
								info.sockets.socket.emit('Buy_Sell_Matching', array_push_alls);

								/*info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', array_remove_buy),
								info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', array_remove_sell),
								info.sockets.io.sockets.in(sellorder.MarketName).emit('MatchingOrder', array_push_market),*/
								update_volume(sellorder.MarketName,item.price,1,sellorder.price,1)
								//MarketName,Last,Bid,Ask,Volum
							}, 500)
							
						)

					})

					
				)
			})
		) : update_volume(sellorder.MarketName,-1,-1,sellorder.price,-1);

	})
}

function matching_sell(buyorder){ 
	var today_date = moment();
	var now_date = moment(today_date).format();
	OrderSell.find({$and : 
		[
            {$where: 'this.price <= '+parseFloat(buyorder.price)+''},
            {'MarketName' : buyorder.MarketName },
            {'status' : 0}
        ]
	}
	,function(err,sellorder){
		var array_push_market = [];
		!err && sellorder.length > 0 ? (
			Sortobject_sell(sellorder,function(sellorder){
				var quantity_Buy;
				var array_remove_buy = [];
				var array_remove_sell = [];
				var array_push_alls = [];
				var soketss = false;
				sellorder && (

					quantity_Buy = parseFloat(buyorder.quantity),

					forEach(sellorder, function(item, index){
						var done = this.async();
						
						//console.log(parseFloat(quantity_Buy),parseFloat(item.quantity));
						if (parseFloat(quantity_Buy).toFixed(8) > parseFloat(item.quantity).toFixed(8) && parseFloat(quantity_Buy).toFixed(8) > 0){
							console.log(">>>>>>>>>>>>>>>>>>");
							array_push_market.push([buyorder.user_id,item.user_id,  buyorder.MarketName, item.quantity, item.price, 'Buy',now_date]);
							Create_market(
								buyorder.user_id,
								item.user_id,
								buyorder.MarketName,
								item.quantity,
								item.price,
								'Buy',
							function(cbb){
								var query;
								var data_update;
								var string_sendrabit;
								cbb && (
									OrderSell.findOneAndUpdate({'_id' : item._id},{'status' : 1},function(errs,result_rm){
										quantity_Buy = parseFloat(quantity_Buy).toFixed(8) - parseFloat(item.quantity).toFixed(8),

										get_balance(buyorder.MarketName.split("-")[1],buyorder.user_id,function(balance_buy){
											
											var new_balance_buy = (parseFloat(balance_buy) + parseFloat(item.quantity)).toFixed(8);

											update_balace(buyorder.MarketName.split("-")[1],new_balance_buy,buyorder.user_id,function(cbsss){
												get_balance(buyorder.MarketName.split("-")[0],item.user_id,function(balance_sell){
													var new_balance_sell = (parseFloat(balance_sell) + (parseFloat(item.quantity)*parseFloat(item.price)/100000000*0.9975)).toFixed(8);
													update_balace(buyorder.MarketName.split("-")[0],new_balance_sell,item.user_id,function(cbsss){
														
													})
												})
											})
										}),

										(sellorder.length - 1 === index && parseFloat(quantity_Buy).toFixed(8) > 0) && 
										(
											//console.log(quantity_Buy),
											query = {'_id' : buyorder._id},
											data_update = {
												quantity : parseFloat(quantity_Buy).toFixed(8),
												total : (parseFloat(quantity_Buy)*parseFloat(item.price)/100000000).toFixed(8),
												price : item.price
											},
											OrderBuy.update(query,data_update,function(errrs,result_ud){
												console.log(result_ud)
											})
										),
										array_remove_sell.push(item),
										
										array_remove_buy.push({
											quantity : parseFloat(item.quantity),
											total : (parseFloat(item.quantity)*parseFloat(item.price)/100000000).toFixed(8),
											price : item.price,
											_id : buyorder._id
										}),
										
										setTimeout(function() {
											//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', item);
											done()
										}, 100);
									})
									
								)
							})
						} 
						else if (parseFloat(quantity_Buy).toFixed(8) == parseFloat(item.quantity).toFixed(8) && parseFloat(quantity_Buy).toFixed(8) > 0)
						{
							
							console.log("=====================");
							array_push_market.push([buyorder.user_id,item.user_id,  buyorder.MarketName, item.quantity, item.price, 'Buy',now_date]);
							Create_market(
								buyorder.user_id,
								item.user_id,
								buyorder.MarketName,
								item.quantity,
								item.price,
								'Buy',
							function(cbb){
								cbb && (
									OrderSell.findOneAndUpdate({'_id' : item._id},{'status' : 1},function(errs,result_rm){
										OrderBuy.findOneAndUpdate({'_id' : buyorder._id},{'status' : 1},function(errs,result_rm){
											quantity_Buy = parseFloat(quantity_Buy).toFixed(8) - parseFloat(item.quantity).toFixed(8),
											get_balance(buyorder.MarketName.split("-")[1],buyorder.user_id,function(balance_buy){
												
												var new_balance_buy = (parseFloat(balance_buy) + parseFloat(item.quantity)).toFixed(8);

												update_balace(buyorder.MarketName.split("-")[1],new_balance_buy,buyorder.user_id,function(cbsss){
													get_balance(buyorder.MarketName.split("-")[0],item.user_id,function(balance_sell){
														var new_balance_sell = (parseFloat(balance_sell) + parseFloat(item.total)*0.9975).toFixed(8);
														update_balace(buyorder.MarketName.split("-")[0],new_balance_sell,item.user_id,function(cbsss){
															
														})
													})
												})
											}),
											array_remove_buy.push(buyorder),
											array_remove_sell.push(item),
											setTimeout(function() {
												//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', buyorder);
												//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', item);
												done()
											}, 100);
										})
									})
								)
							});
						}
						else if (parseFloat(quantity_Buy).toFixed(8) < parseFloat(item.quantity).toFixed(8) && parseFloat(quantity_Buy).toFixed(8) > 0)
						{
							console.log("<<<<<<<<<<<<<<<<<");
							array_push_market.push([buyorder.user_id,item.user_id,  buyorder.MarketName, quantity_Buy, item.price, 'Buy',now_date]);
							Create_market(
								buyorder.user_id,
								item.user_id,
								buyorder.MarketName,
								quantity_Buy,
								item.price,
								'Buy',
							function(cbb){
								var query_ud;
								var data_ud;
								cbb && (
									
									OrderSell.update({'_id' : item._id},{'status' : 1},function(errs,result_rm){
										OrderBuy.update({'_id' : buyorder._id},{'status' : 1},function(errs,result_rm){
											console.log(parseFloat(item.quantity),parseFloat(quantity_Buy),"123123213");
											var quantity_sub = parseFloat(item.quantity).toFixed(8) - parseFloat(quantity_Buy).toFixed(8);

											var quantitysss = quantity_sub;
											var totalsss = (quantity_sub*parseFloat(item.price)/100000000).toFixed(8);
											var subtotalsss = quantitysss*parseFloat(item.price)/100000000;
											var commissionsss = quantitysss*parseFloat(item.price)/100000000*0.0025;
											var balance_add;
											var amount_add_quanty;
											newOrderSell(item.user_id, item.MarketName,quantitysss,item.price, subtotalsss, commissionsss,totalsss).save(( err, DepositStored)=>{
												!err &&  (
													balance_add = (parseFloat(quantity_Buy)*parseFloat(item.price)/100000000).toFixed(8),
													amount_add_quanty = quantity_Buy,
													quantity_Buy = parseFloat(quantity_Buy) - parseFloat(item.quantity),
													get_balance(buyorder.MarketName.split("-")[1],buyorder.user_id,function(balance_sell){

														var new_balance_sell = (parseFloat(balance_sell).toFixed(8) + (amount_add_quanty)).toFixed(8);
															
														update_balace(buyorder.MarketName.split("-")[1],new_balance_sell,buyorder.user_id,function(cbsss){
															
															get_balance(buyorder.MarketName.split("-")[0],item.user_id,function(balance_buy){
																var new_balance_buy = (parseFloat(balance_buy) +  parseFloat(balance_add)*0.9975).toFixed(8);
																update_balace(buyorder.MarketName.split("-")[0],new_balance_buy,item.user_id,function(cbsss){
																		
																})
															})
														})
													}),
													array_remove_buy.push(buyorder),
													array_remove_sell.push(item),
													soketss = true,
													setTimeout(function() {
														//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', buyorder);
														//info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', item);
														done()
													}, 100)
												)
											})
										});
									})
								)
							});
						};
						
						(sellorder.length - 1 === index || soketss) && (
							setTimeout(function() {
								array_push_alls.push({
									'OrderBuy_remove' : array_remove_buy,
									'OrderSell_remove' : array_remove_sell,
									'MatchingOrder' : array_push_market
								});

								info.sockets.socket.broadcast.emit('Buy_Sell_Matching', array_push_alls),
								info.sockets.socket.emit('Buy_Sell_Matching', array_push_alls);
								/*info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderBuy:remove', array_remove_buy);

								info.sockets.io.sockets.in(info.sockets.socket.Exchange).emit('OrderSell:remove', array_remove_sell);
								info.sockets.io.sockets.in(buyorder.MarketName).emit('MatchingOrder', array_push_market),*/
								update_volume(buyorder.MarketName,item.price,buyorder.price,1,1)
							}, 500)
						)

					})
				)
			})
		) : update_volume(buyorder.MarketName,-1,buyorder.price,-1,-1)

			
	});
}



function process_buy_exchange(string_receiverabit , callback){

	process_buy(string_receiverabit, function(cb){
		//callback(true)
		cb ? callback(true) : callback(false)
	});
}

function process_sell_exchange(string_receiverabit , callback){

	process_sell(string_receiverabit, function(cb){
		cb ? callback(true) : callback(false)
	});
}

function process_cancel_order_open(string_receiverabit , callback){

	process_cancel_order(string_receiverabit, function(cb){
		cb ? callback(true) : callback(false)
	});
}

function robo_trade_sell(){
	Volume.findOne({'MarketName' : 'BTC-WAVE'},function(err,volume){
		if (volume)
		{
			if (parseFloat(volume.volume_last))
			{
				var last = parseFloat(volume.ask);
				var quantity = parseInt(_.random(10,50));
				var rand_price_add  = parseInt(_.random(2,10));
				var subtotal = parseFloat(quantity) * (parseFloat(last)+parseFloat(rand_price_add));
				var commission = (subtotal*0.0025).toFixed(8);
				var randomss = _.random(1,2);
				console.log(randomss);
				if (parseInt(randomss) == 1)
				{
					newOrderSell("5a662096595b73233a4e8150", "BTC-WAVE",quantity*100000000,parseFloat(last)-parseFloat(rand_price_add), subtotal, commission, subtotal).save(( err,order_create)=>{
						order_create && matching_buy(order_create);        		
						setTimeout(function() {
							newOrderBuy("5a662096595b73233a4e8150", "BTC-WAVE",quantity*100000000,parseFloat(last)-parseFloat(rand_price_add), subtotal, commission, subtotal).save(( err,order_createdd)=>{
								order_createdd && matching_sell(order_createdd);
							})
						}, 20000);

					})
				}
				else
				{
					newOrderBuy("5a662096595b73233a4e8150", "BTC-WAVE",quantity*100000000,parseFloat(last)-parseFloat(rand_price_add), subtotal, commission, subtotal).save(( err,order_createdd)=>{
						order_createdd && matching_sell(order_createdd);
						setTimeout(function() {
							newOrderSell("5a662096595b73233a4e8150", "BTC-WAVE",quantity*100000000,parseFloat(last)-parseFloat(rand_price_add), subtotal, commission, subtotal).save(( err,order_create)=>{
								order_create && matching_buy(order_create);        		
							})	
						}, 10000);
					})
				}
			}
		}
	});
}



setTimeout(function() {
	//initssss();
}, 20000);
function initssss() {
    var myFunction = function() {
        robo_trade_sell();
        var rand = Math.round(Math.random() * (120000 - 500)) + 60000; 
        setTimeout(myFunction, rand);
    }
    myFunction();
}


setTimeout(function() {
	
}, 20000);

function remove_all_sell_order(){
	OrderSell.find({$and : 
		[
            {'MarketName' : 'BTC-WAVE' },
            {'status' : 0}
        ]
	},function(err,sellorder){
		!err && sellorder.length > 0 ? (
			forEach(sellorder, function(item, index){
				var done = this.async();
				var query = {'_id':item._id};
				var data_update = {
					$set : {
						'status': 8
					}
				};
				OrderSell.findOneAndRemove(query, function(err, Users){
					var wallet_name =  'WAVE';
					var value_update = item.quantity;
					!err ? (
						get_balance(wallet_name,item.user_id,function(ast_balance){
							var new_ast_balance = (parseFloat(ast_balance) + parseFloat(value_update) ).toFixed(8);
							update_balace(wallet_name , new_ast_balance,item.user_id,function(cb){
								Users.remove()
							})
						})
					) : callback(false);
					console.log(index);
					setTimeout(function() {
						done();
					}, 2000);
					
				})

				
			})
		) : console.log("null")

	});
}

return module.exports = {
	infoSocket : function(socket, io){
		info.sockets = [socket, io];
	},
	module : function(){
		return {
			process_buy_exchange,
			process_sell_exchange,
			process_cancel_order_open
		}
	}
}
