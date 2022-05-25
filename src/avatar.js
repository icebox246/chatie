const { createHash } = require("crypto");


function generateAvatar(name) {
	const hash = createHash("sha1").update(name).digest("hex").slice(2,12);

	const size = 64;
	const rad = size / 2;

	let pathString = `M ${rad} 0 `;

	let a = 0;
	for(let i in hash) {
		a += hash.charCodeAt(i) * 0.7492 * (i ** 2);

		pathString += `L ${Math.floor(Math.sin(a) * rad + rad)} ${Math.floor(Math.cos(a) * rad + rad)} `;
	}

	pathString += 'Z';

	return ` <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="none" viewBox="0 0 ${size} ${size}" stroke="white" stroke-width="1">
			<path id="p1" d="${pathString}" />
		</svg>`;
}

module.exports = {
	generateAvatar
}
