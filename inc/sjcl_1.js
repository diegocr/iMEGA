var sjcl = {
	cipher : {}
	
};
sjcl.cipher.aes = function (a) {
	this.a[0][0][0] || this.d();
	var d,
	c,
	g,
	b,
	e = this.a[0][4],
	f = this.a[1];
	d = a.length;
	var j = 1;
	this.c = [g = a.slice(0), b = []];
	for (a = d; a < 4 * d + 28; a++) {
		c = g[a - 1];
		if (a % d === 0 || d === 8 && a % d === 4) {
			c = e[c >>> 24] << 24^e[c >> 16 & 255] << 16^e[c >> 8 & 255] << 8^e[c & 255];
			if (a % d === 0) {
				c = c << 8^c >>> 24^j << 24;
				j = j << 1^(j >> 7) * 283
			}
		}
		g[a] = g[a - d]^c
	}
	for (d = 0; a; d++, a--) {
		c = g[d & 3 ? a : a - 4];
		b[d] = a <= 4 || d < 4 ? c : f[0][e[c >>> 24]]^f[1][e[c >> 16 & 255]]^f[2][e[c >> 8 & 255]]^f[3][e[c & 255]]
	}
};
sjcl.cipher.aes.prototype = {
	encrypt : function (a) {
		return this.b(a, 0)
	},
	decrypt : function (a) {
		return this.b(a, 1)
	},
	a : [[[], [], [], [], []], [[], [], [], [], []]],
	d : function () {
		var a = this.a[0],
		d = this.a[1],
		c = a[4],
		g = d[4],
		b,
		e,
		f,
		j = [],
		l = [],
		m,
		i,
		h,
		k;
		for (b = 0; b < 0x100; b++)
			l[(j[b] = b << 1^(b >> 7) * 283)^b] = b;
		for (e = f = 0; !c[e]; e ^= m || 1, f = l[f] || 1) {
			h = f^f << 1^f << 2^f << 3^f << 4;
			h = h >> 8^h & 255^99;
			c[e] = h;
			g[h] = e;
			i = j[b = j[m = j[e]]];
			k = i * 0x1010101^b * 0x10001^m * 0x101^e * 0x1010100;
			i = j[h] * 0x101^h * 0x1010100;
			for (b = 0; b < 4; b++) {
				a[b][e] = i = i << 24^i >>> 8;
				d[b][h] = k = k << 24^k >>> 8
			}
		}
		for (b = 0; b < 5; b++) {
			a[b] = a[b].slice(0);
			d[b] = d[b].slice(0)
		}
	},
	b : function (a, d) {
		var c = this.c[d],
		g = a[0]^c[0],
		b = a[d ? 3 : 1]^c[1],
		e = a[2]^c[2];
		a = a[d ? 1 : 3]^c[3];
		var f,
		j,
		l,
		m = c.length / 4 - 2,
		i,
		h = 4,
		k = [0, 0, 0, 0];
		f = this.a[d];
		var n = f[0],
		o = f[1],
		p = f[2],
		q = f[3],
		r = f[4];
		for (i = 0; i < m; i++) {
			f = n[g >>> 24]^o[b >> 16 & 255]^p[e >> 8 & 255]^q[a & 255]^c[h];
			j = n[b >>> 24]^o[e >> 16 & 255]^p[a >> 8 & 255]^q[g & 255]^c[h + 1];
			l = n[e >>> 24]^o[a >> 16 & 255]^p[g >> 8 & 255]^q[b & 255]^c[h + 2];
			a = n[a >>> 24]^o[g >> 16 & 255]^p[b >> 8 & 255]^q[e & 255]^c[h + 3];
			h += 4;
			g = f;
			b = j;
			e = l
		}
		for (i = 0; i < 4; i++) {
			k[d ? 3 & -i : i] = r[g >>> 24] << 24^r[b >> 16 & 255] << 16^r[e >> 8 & 255] << 8^r[a & 255]^c[h++];
			f = g;
			g = b;
			b = e;
			e = a;
			a = f
		}
		return k
	}
};
