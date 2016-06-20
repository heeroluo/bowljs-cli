/*!
 * Command line tools for Bowljs
 * File class (2016-06-20T10:02:48+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';

var fs = require('fs'),
	path = require('path'),
	util = require('./util'),
	console = require('./console');


// 文件类
function File(p) {
	this._path = path.normalize(p);
}
util.extend(File.prototype, {
	// 获取文件是否存在
	exists: function() {
		if (this._exists == null) { this._exists = fs.existsSync(this._path); }
		return this._exists;
	},

	// 获取文件路径
	path: function() { return this._path; },
 
	// 读取文件内容
	read: function() {
		var content, p = this._path;
		try {
			console.info('open {{' + p + '}}');
			content = fs.readFileSync(p, 'utf8');
		} catch (e) {
			throw new Error('cannot open file: {{' + p + '}}');
		}

		return content;
	},

	// 读取文件内容并转换为JSON
	readAsJSON: function() {
		var content = this.read(), json;
		if (content) {
			content = content.replace(/^\s*\/{2,}.*$/mg, '');
			try {
				json = JSON.parse(content);
			} catch(e) {
				console.warn('parse JSON failed: {{' + this._path + '}}');
			}
		}

		return json;
	}
});

// 对目录下的每个文件执行操作
File.eachFile = function(p, callback, ignorePaths) {
	if (ignorePaths) {
		var isIgnored = ignorePaths.some(function(rule) {
			return rule.test(p);
		});
		if (isIgnored) { return; }
	}

	var stat = fs.statSync(p);
	if ( stat.isFile() ) {
		callback(p);
	} else if ( stat.isDirectory() ) {
		var all = fs.readdirSync(p);
		if (all) {
			all.forEach(function(sub) {
				File.eachFile(path.join(p, sub), callback, ignorePaths);
			});
		}
	}
};


module.exports = File;