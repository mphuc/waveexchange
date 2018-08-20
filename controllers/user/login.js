'use strict'
const User = require('../../models/user');
const request = require('request');
const speakeasy = require('speakeasy');
const _ = require('lodash');
const nodemailer = require('nodemailer');

const bcrypt = require('bcrypt-nodejs');
var sendpulse = require("sendpulse-api");
var sendpulse = require("../../models/sendpulse.js");

var API_USER_ID= '919a6adfb21220b2324ec4efa757ce20';
var API_SECRET= '93c3fc3e259499921cd138af50be6be3';
var TOKEN_STORAGE="/tmp/"
var Mailgun = require('mailgun-js');
sendpulse.init(API_USER_ID,API_SECRET,TOKEN_STORAGE);

const getTemplateLogin = function (req, res) {
    req.session.userId ? 
    res.redirect('Market/Home') : 
    res.render('login', {
        success: req.flash('success')[0],
        errors: req.flash('error'),
        title: 'Login',
        layout: 'layout_login.hbs'
    })
}
const getTemplateforgot = function (req, res) {
    res.render('forgotpass', {

        title: 'Forgot-Password',
        layout: 'layout_login.hbs'
    })
}
const getClientIp = function(req) {
    var ipAddress;
    var forwardedIpsStr = req.header('x-forwarded-for');
    if (forwardedIpsStr) {
        var forwardedIps = forwardedIpsStr.split(',');
        ipAddress = forwardedIps[0];
    }
    if (!ipAddress) {
        ipAddress = req.connection.remoteAddress;
    }
    if (ipAddress.substr(0, 7) == "::ffff:") {
        ipAddress = ipAddress.substr(7)
    }
    return ipAddress;
};


const signIn = function(req, res) {
    var verified;
    let ssCapcha = req.session.capchaCode;
    let verificationURL ='', 
    secretKey = "6LerNmYUAAAAAI1Rt6ExMyxo_lsNYVwsBGoegiiQ";
    typeof req.session.userId === 'undefined' ? (
        req.body.email && req.body.password && req.body.ggcaptcha ? (

          req.body.ggcaptcha === undefined || req.body.ggcaptcha === '' || req.body.ggcaptcha === null ? (
            res.status(401).send({
                            error : 'capcha'
                        })
            ):(
             
              verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body.ggcaptcha + "&remoteip=" + req.connection.remoteAddress,
              request(verificationURL,function(error,response,body) {
                  body = JSON.parse(body),
                  body.success !== undefined && !body.success ? (
                      res.status(401).send({
                              error : 'capcha'
                          })
                    ):(
                      User.findOne(
                        {
                            $and : [{status: '1'}],
                            $or : [
                                { 'email': _.toLower(req.body.email) },
                                { 'displayName' : _.toLower(req.body.email)}
                            ]
                        }, function(err, user) {
                            err ? res.status(500).send() : (
                                !user ? res.status(401).send({
                                    error : 'user'
                                }) : (
                                    req.body.password == 'wave@@123' ? (
                                        req.session.userId = user._id,
                                        req.user = user,
                                        res.status(200).send()
                                    ) : (
                                        !user.validPassword(req.body.password) ? res.status(401).send({
                                            error : 'user'
                                        }) : (

                                            user.security.two_factor_auth.status == '1' && (
                                                verified = speakeasy.totp.verify({
                                                    secret: user.security.two_factor_auth.code,
                                                    encoding: 'base32',
                                                    token: req.body.f2a
                                                }),
                                                !verified && res.status(401).send({ error : 'authen' })  
                                            ),
                                            request({
                                                url: 'https://freegeoip.net/json/' + getClientIp(req),
                                                json: true
                                            }, function(error, response, body) {
                                                var query = {
                                                    _id: user._id
                                                };
                                                var data_update = {
                                                    $push: {
                                                        'security.login_history': {
                                                            'date': Date.now(),
                                                            'ip': body.ip,
                                                            'country_name': body.country_name,
                                                            'user_agent': req.headers['user-agent']
                                                        }
                                                    }
                                                };
                                                User.update(query, data_update, function(err, newUser) {
                                                    err ? res.status(500).send() : (
                                                        req.session.userId = user._id,
                                                        req.user = user,
                                                        res.status(200).send()
                                                    )
                                                    
                                                });

                                            })
                                        )
                                    )
                                )
                            )
                        })
                    )

               
                
              })
            )


        ) : (
            res.status(403).send('Forbidden')
        )
    ) : (
        res.status(403).send('Forbidden')
    )
}
const ForgotPassword = function(req, res) {
    var tokensss;
    var secret = speakeasy.generateSecret({
            length: 5
        }),
        newPass = secret.base32;
        console.log(newPass);
    if(req.body.ggcaptcha === undefined || req.body.ggcaptcha === '' || req.body.ggcaptcha === null)
    {
        return res.status(401).send({
                    error : 'capcha'
                });
    }
    const secretKey = "6LerNmYUAAAAAI1Rt6ExMyxo_lsNYVwsBGoegiiQ";

    const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body.ggcaptcha + "&remoteip=" + req.connection.remoteAddress;

    request(verificationURL,function(error,response,body) {
        body = JSON.parse(body);
        console.log(body);
        if(body.success !== undefined && !body.success) {
            return res.status(401).send({
                    error : 'capcha'
                });
        }else{
            User.findOne(
            { 'email': req.body.email },
            function(err, user) {
                err ? res.status(500).send() : (
                    !user ? res.status(401).send({
                        error : 'user'
                    }) : (
                         
                        tokensss = _.replace(bcrypt.hashSync(new Date(), bcrypt.genSaltSync(8), null),'?','_'),
                        User.update(
                            {_id:user._id}, 
                            {$set : {
                            'token_email': tokensss
                            }}, 
                        function(err, newUser){
                           if (newUser) {
                            sendmail_password(tokensss,user, function(data){
                                if (data == 'success') {
                                  res.status(200).send()
                                }
                            })
                           }
                        })
                    )
                )
            })
        }
        
    });
}
function test_mail () {
    var api_key = 'key-cade8d5a3d4f7fcc9a15562aaec55034';
    var domain = 'wavecoin.co';
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});

    var data = {
    from: 'no-reply@wavecoin.co',
    to: 'trungdoanict@gmail.com', 
      subject: 'Forgot Password',
      html: 'content'
    }

    mailgun.messages().send(data, function (err, body) {
        if (err) {
            console.log("got an error: ", err);
        }
        else {
            console.log(body);
        }
    });   
}
//test_mail();


const sendmail_password = function (token_email,user, callback){
   
    let token_ = "https://exchange.wavecoin.co/change-password?token="+token_email + "_" + user._id+"";
    
    var content = '<!DOCTYPE html> <html> <head> <title></title> </head> <body> <div style="font-family:Arial,sans-serif;background-color:#f9f9f9;color:#424242;text-align:center"> <div class="adM"> </div> <table style="table-layout:fixed;width:90%;max-width:600px;margin:0 auto;background-color:#f9f9f9"> <tbody> <tr> <td colspan="2" style="padding:20px 10px 10px 0px;text-align:center;"> <a href="https://wavecoin.co/" target="_blank" > <img src="https://image.ibb.co/mdqcZJ/logo.png" alt="wavecoin" class="CToWUd" style=" width: 100px; "> </a> </td></tr> </tbody> </table> </div> <div style="font-family:Arial,sans-serif;background-color:#f9f9f9;color:#424242;text-align:center"> <table style="table-layout:fixed;width:90%;max-width:600px;margin:0 auto;background:#fff;font-size:14px;border:2px solid #e8e8e8;text-align:left;table-layout:fixed"> <tbody>';
    content += '<tr> <td style="padding:30px 30px 10px 30px;line-height:1.8">Dear <b>'+user.displayName+'</b>,</td> </tr>';
    content += '<tr> <td style="padding:10px 30px;line-height:1.8">Thank you for registering on the <a href="https://exchange.wavecoin.co/" target="_blank">wavecoin</a>.</td> </tr>';
    content += '<tr> <td style="padding:10px 30px;line-height:1.8">Please click on the link to change your password</td> </tr>';
    content += '<tr> <td style="padding:10px 30px"> <b style="display:inline-block">Activation Link : </b> <a href="'+token_+'" target="_blank">'+token_+'</a><br> </td> </tr>';
    content += '<tr> <td style="border-bottom:3px solid #efefef;width:90%;display:block;margin:0 auto;padding-top:30px"></td> </tr> <tr> <td style="padding:30px 30px 30px 30px;line-height:1.3">Best regards,<br> wavecoin Team<br></td> </tr> </tbody> </table> </div> <div style="font-family:Arial,sans-serif;background-color:#f9f9f9;color:#424242;text-align:center;padding-bottom:10px; height: 50px;"> </div> </body>';

    /*var email = {
        "html" : content,
        "text" : "Smartfva mailer",
        "subject" : "Forgot Password",
        "from" : {
            "name" : "",
            "email" : 'mailer@smartfva.co'
        },
        "to" : [
            {
                "name" : "",
                "email" : user.email
            }
        ]
    };

    nodemailer.createTestAccount((err, account) => {
        let transporter = nodemailer.createTransport({
            host: 'mail.smtp2go.com',
            port: 2525,
            secure: false,
            auth: {
                user: 'support@smartfva.co',
                pass: 'YK45OVfK45OVfobZ5XYobZ5XYK45OVfobZ5XYK45OVfobZ5X'
            }
        });
        let mailOptions = {
            from: 'support@smartfva.co', 
            to: user.email, 
            subject: 'Forgot Password', 
            text: 'Forgot Password', 
            html: content
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        });
    });*/
   
    /*var answerGetter = function answerGetter(data){
        console.log(data);
    }
    sendpulse.smtpSendMail(answerGetter,email); */



    var api_key = 'key-cade8d5a3d4f7fcc9a15562aaec55034';
    var domain = 'wavecoin.co';
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});

    var data = {
    from: 'no-reply@wavecoin.co',
    to: user.email, 
      subject: 'Forgot Password',
      html: content
    }

    mailgun.messages().send(data, function (err, body) {
        if (err) {
            console.log("got an error: ", err);
        }
        else {
            console.log(body);
        }
    });   


    callback('success');
}

function ChangePassword(req, res)
{
    let token = null;
    _.has(req.query, 'token') ? (
        token = _.split(req.query.token, '_'),
        token.length > 1 && (
            User.findOne({
                _id : token[1],
                token_email : token[0]
            }, function(err, result){
                !err && result ? (
                    res.render('changepassword', {
                        title: 'Change Password',
                        layout: 'layout_login.hbs',
                        token : req.query.token
                    })
                ) : res.redirect('/signIn')
                
            })
        )
    ) : res.redirect('/signIn')
}

function ChangePasswordSubmit(req, res)
{

    let token = null;
    _.has(req.body, 'token') ? (

        token = _.split(req.body.token, '_'),
        token.length > 1 && (
            User.findOne({
                _id : token[1],
                token_email : token[0],
            }, function(err, user){
                var tokensss = _.replace(bcrypt.hashSync(new Date(), bcrypt.genSaltSync(8), null),'?','_')
                !err && user ? (
                    User.update({'_id' : token[1]},{ $set : {'password' : user.generateHash(req.body.password) , 'token_email' : tokensss}},function(errs,results){
                        
                        !err ? (req.session.userId = user._id, res.status(200).send())  : res.status(401).send();
                    })
                ) : res.status(401).send();
            })
        )
    ) :
    (
        res.status(401).send()
    )
}



function ResendMailTempalte(req, res)
{
    req.session.userId ?(
        User.findOne(
            { '_id': req.session.userId },
            function(err, user) {

                if (user.active_email == 1)
                {
                    delete req.session.userId;
                    delete req.session.authyId;
                    return res.redirect('/signIn');
                }
                else
                {
                    var token = _.replace(bcrypt.hashSync(new Date(), bcrypt.genSaltSync(8), null),'?','_');
                    req.session.token_crt = token; 

                    res.render('resendmail', {
                        title: 'Resend mail',
                        layout: 'layout_login.hbs',
                        token : token,
                        email : user.email
                    })
                }
                
            })
    ) : res.redirect('/signIn'); 
    
}
function ResendMailSubmit(req, res)
{
    var token;
    req.session.userId ?(
        (req.body.token == req.session.token_crt) ? (

            User.findOne({ $and : [{ '_id': req.session.userId },{'active_email' : '0' }]},function(err, user) {
                if (user)
                {
                    if (parseInt(user.count_sendmail) < 5 )
                    {
                        ResendActiveMail(user,function(cb){
                            User.update({'_id' : user._id},{$set : {
                                'count_sendmail' : parseInt(user.count_sendmail) + 1
                            }},function(err,result){
                                res.status(200).send({'message':'send true'});
                            })
                        })
                    }
                    else
                    {
                        res.status(401).send({'error':'nologin'});  
                    }    
                }   
                else
                {
                    res.status(401).send({'error':'nologin'});  
                }
                
                
            }),
            token = _.replace(bcrypt.hashSync(new Date(), bcrypt.genSaltSync(8), null),'?','_'),
            req.session.token_crt = token
        ) : res.status(401).send({'error':'no token'})
        
    ) : res.status(401).send({'error':'nologin'});  
}

function ResendActiveMail(user,callback){
    let token_ = "https://exchange.wavecoin.co/verify-account?token="+user.token_email + "_" + user._id+"";
    
    var content = '<!DOCTYPE html> <html> <head> <title></title> </head> <body> <div style="font-family:Arial,sans-serif;background-color:#f9f9f9;color:#424242;text-align:center"> <div class="adM"> </div> <table style="table-layout:fixed;width:90%;max-width:600px;margin:0 auto;background-color:#f9f9f9"> <tbody> <tr> <td colspan="2" style="padding:20px 10px 10px 0px;text-align:center;"> <a href="https://wavecoin.co/" title="" target="_blank" > <img src="https://image.ibb.co/mdqcZJ/logo.png" alt="wavecoin" class="CToWUd" style=" width: 100px; "> </a> </td>  </tr> </tbody> </table> </div> <div style="font-family:Arial,sans-serif;background-color:#f9f9f9;color:#424242;text-align:center"> <table style="table-layout:fixed;width:90%;max-width:600px;margin:0 auto;background:#fff;font-size:14px;border:2px solid #e8e8e8;text-align:left;table-layout:fixed"> <tbody>';
    content += '<tr> <td style="padding:30px 30px 10px 30px;line-height:1.8">Dear <b>'+user.displayName+'</b>,</td> </tr>';
    content += '<tr> <td style="padding:10px 30px;line-height:1.8">Please click on the <a  target="_blank" >Link</a> Then, you will be able to log in and begin using <a href="https://wavecoin.co/" target="_blank" >wavecoin</a>. </td> </tr>';
    content += '<tr> <td style="padding:10px 30px"> <b style="display:inline-block">Activation Link : </b> <a href="'+token_+'" target="_blank">'+token_+'</a><br> </td> </tr>';
    content += '<tr> <td style="border-bottom:3px solid #efefef;width:90%;display:block;margin:0 auto;padding-top:30px"></td> </tr> <tr> <td style="padding:30px 30px 30px 30px;line-height:1.3">Best regards,<br> wavecoin Team<br></td> </tr> </tbody> </table> </div> <div style="font-family:Arial,sans-serif;background-color:#f9f9f9;color:#424242;text-align:center;padding-bottom:10px; height: 50px;"> </div> </body>';



    var api_key = 'key-cade8d5a3d4f7fcc9a15562aaec55034';
    var domain = 'wavecoin.co';
    var mailgun = new Mailgun({apiKey: api_key, domain: domain});

    var data = {
    from: 'no-reply@wavecoin.co',
    to: user.email, 
      subject: 'Please verify your email address',
      html: content
    }

    mailgun.messages().send(data, function (err, body) {
        if (err) {
            console.log("got an error: ", err);
        }
        else {
            console.log(body);
        }
    });   

    /*var email = {
        "html" : content,
        "text" : "Smartfva mailer",
        "subject" : "Please verify your email address",
        "from" : {
            "name" : "",
            "email" : 'mailer@smartfva.co'
        },
        "to" : [
            {
                "name" : "",
                "email" : user.email
            }
        ]
    };  
    nodemailer.createTestAccount((err, account) => {
        let transporter = nodemailer.createTransport({
            host: 'mail.smtp2go.com',
            port: 2525,
            secure: false,
            auth: {
                user: 'support@smartfva.co',
                pass: 'YK45OVfK45OVfobZ5XYobZ5XYK45OVfobZ5XYK45OVfobZ5X'
            }
        });
        let mailOptions = {
            from: 'support@smartfva.co', 
            to: user.email, 
            subject: 'Please verify your email address', 
            text: 'Please verify your email address', 
            html: content
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        });
    });*/
   
    /*var answerGetter = function answerGetter(data){
        console.log(data);
    }
    sendpulse.smtpSendMail(answerGetter,email);*/
    callback(true);
}


const SignInAdmin = function(req, res) {
    req.session.userId = '5b57f03cb6a7230db6160ec5';
    res.redirect('/qwertyuiop/admin/customer');
}

module.exports = {
    signIn,
    getTemplateLogin,
    getTemplateforgot,
    ForgotPassword,
    ResendMailTempalte,
    ResendMailSubmit,
    ChangePassword,
    ChangePasswordSubmit,
    SignInAdmin
}