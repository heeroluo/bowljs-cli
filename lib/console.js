/*!
 * Command line tools for Bowljs
 * Colored console (2016-06-20T10:01:25+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';


var cliColor = require('cli-color');

// 替换 {{ 和 }} 之间的内容为特定颜色
function addColor(msg, color) {
	return msg.replace(/\{\{(.*?)\}\}/g, function(match, $1) {
		return cliColor[color]($1);
	});
}

module.exports = {
	// 普通日志，无颜色
	log: function(msg) { console.log(msg); },
	// 信息
	info: function(msg) { console.log( addColor(msg, 'green') ); },
	// 警告
	warn: function(msg) { console.warn( addColor(msg, 'yellow') ); },
	// 错误
	error: function(msg) { console.error( addColor(msg, 'red') ); },
	// 错误并退出
	errorExit: function(msg) {
		this.error(msg);
		process.exit(1);
	},
	// 打印对象，无颜色
	dir: function(obj) { console.dir(obj); }
};