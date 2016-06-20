/*!
 * Command line tools for Bowljs
 * Utility functions (2016-06-20T10:03:08+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';


var path = require('path'),
	fs = require('fs'),
	console = require('./console');


// 把源对象的属性扩展到目标对象
exports.extend = function(target) {
	if (target == null) { throw new Error('target cannot be null'); }

	var i = 0, len = arguments.length, key, src;
	while (++i < len) {
		src = arguments[i];
		if (src != null) {
			for (key in src) {
				if ( src.hasOwnProperty(key) ) { target[key] = src[key]; }
			}
		}
	}

	return target;
};

// 大小写不敏感的子字符串查找
var iIndexOf = exports.iIndexOf = function(target, str) {
	return target.toLowerCase().indexOf( str.toLowerCase() );
};

// 大小写不敏感的字符串替换
exports.iReplace = function(target, str, replacement) {
	var i = iIndexOf(target, str);
	return i === -1 ? target :
		( target.substr(0, i) + replacement + target.substr(i + str.length) );
};

// 根据值去重复
exports.literalUnique = function(arr, key) {
	var result = [ ], temp = { }, value;

	for (var i = 0; i < arr.length; i++) {
		value = arr[i];

		// key不为null的情况下，按key对应的属性值去重复
		if (key != null) { value = value[key]; }

		if ( !temp.hasOwnProperty(value) ) {
			temp[value] = true;
			result.push(arr[i]);
		}
	}

	return result;
};

// 在路径末尾加上分隔符
exports.addPathSepToEnd = function(p) {
	return p.charAt(p.length - 1) !== path.sep ? p + path.sep : p;
};

// 检查路径是否存在
exports.checkPath = function(p, pathEmptyCallback) {
	p = (p || '').trim();
	if (p) {
		p = path.resolve(p);
		if ( fs.existsSync(p) ) {
			return p;
		} else {
			console.errorExit('{{' + p + '}} does not exist');
		}
	} else {
		return pathEmptyCallback();
	}
};

// 把数组二的元素合并到数组一
exports.merge = function(first, second) {
	var len = second.length, j = 0, i = first.length;
	while (j < len) {
		first[i++] = second[j++];
	}
	first.length = i;

	return first;
};

// 创建类
exports.createClass = function(constructor, methods, Parent) {
	var $Class = Parent ? function() {
		Parent.apply(this, arguments);
		constructor.apply(this, arguments);
	} : function() { constructor.apply(this, arguments); };

	if (Parent) {
		$Class.prototype = Object.create(Parent.prototype);
		$Class.prototype.constructor = $Class;
	}

	if (methods) {
		for (var m in methods) {
			if ( methods.hasOwnProperty(m) ) {
				$Class.prototype[m] = methods[m];
			}
		}
	}

	return $Class;
};