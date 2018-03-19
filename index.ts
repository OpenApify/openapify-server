import debug from 'debug';
import * as http from 'http';
import * as url from 'url';
import * as OpenApify from 'openapify';
import {JSONfn} from 'jsonfn';


const log = debug('openapify');
OpenApify.SetLog(log);

let Jobs: OpenApify.Job[] = [];

let port = process.env.PORT || 8000;
let authToken = process.env.AUTHTOKEN;

const config = {
    Headless: true,
}

if (authToken !== undefined && authToken !== null) {
    log(`Enabled auth with token '${authToken}'`);
	authToken = `Bearer ${authToken}`;
} else {
    authToken = '';
}


function parseJSON(res: http.ServerResponse, rawData: string): object {
	try {
		return JSONfn.parse(rawData);
	} catch (e) {
        log("Unable to parse JSON: ", e);
        res.writeHead(400, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({
			'Error': e.toString(),
		}));
		return null;
	}
}

function parseJob(res: http.ServerResponse, data: object): OpenApify.Job {
    try {
        return OpenApify.Job.FromData(data);
    } catch (e) {
        log("Unable to parse Job: ", e);
        res.writeHead(400, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({
			'Error': e.toString(),
		}));
		return null;
    }
}

function fieldsSet(res: http.ServerResponse, data : any , ...fields : string[]) : boolean {
	for (let i = fields.length - 1; i >= 0; --i) {
		const field = fields[i];
		if (data[field] == undefined || data[field] == null) {
			res.writeHead(400, {'Content-Type': 'application/json'});
			res.end(JSON.stringify({
				'Error': `Missing field ${field}`,
			}));
			return false;
		}		
	}
	return true;
}

const routes = {
	"/sync": {
		'Method': 'POST',
		'Content-Type': 'application/json',
		'Handler': (req, res) => {
			let rawData = '';
			req.on('data', (chunk) => {
				rawData += chunk;
			});
			req.on('end', async () => {
				const requestData = parseJSON(res, rawData);
				if (requestData == null) {
                    return;
                }
                const job = parseJob(res, requestData);
                if (job == null) {
                    return;
                }
                Jobs.push(job);
                log("Running Apify");
                await OpenApify.Apify(job, config);
                let resultData = job.ToData(); 
				res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSONfn.stringify(job.ToData()));
			});
		},
	},
	"/async": {
		'Method': 'POST',
		'Content-Type': 'application/json',
		'Handler': (req, res) => {
			let rawData = '';
			req.on('data', (chunk) => {
				rawData += chunk;
			});
			req.on('end', () => {
				const requestData = parseJSON(res, rawData);
				if (requestData == null) {
                    return;
                }
                const job = parseJob(res, requestData);
                if (job == null) {
                    return;
                }
                Jobs.push(job);
                log("Running Apify");
                OpenApify.Apify(job, config);
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSONfn.stringify(job.ToData()));
			});
		},
	},
	"/status": {
		'Method': 'POST',
		'Content-Type': 'application/json',
		'Handler': (req, res) => {
			let rawData = '';
			req.on('data', (chunk) => {
				rawData += chunk;
			});
			req.on('end', () => {
				const requestData = parseJSON(res, rawData);
				if (requestData != null) {
					if (!fieldsSet(res, requestData, 'Id')) {
						return
					}
					let id = requestData['Id'];
					for (let i = Jobs.length - 1; i >= 0; i--) {
						if (Jobs[i].Id == id) {
							res.end(JSONfn.stringify(Jobs[i].ToData()));
							return
						}
					}
					res.writeHead(404, {'Content-Type': 'application/json'});
					res.end(JSON.stringify({
						'Error': `Unknown ID ${id}`,
					}));
				}
			});
		},
	},
}


const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
	let u = url.parse(req.url, true);
	log(`${req.connection.remoteAddress} ${req.method} ${u.pathname}`);
	if (authToken.length > 0 && req.headers['authorization'] != authToken) {
		log(`${req.connection.remoteAddress} Invalid token`);
		res.writeHead(401, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({
			'Error': 'Access Denied',
		}));
		return;
	}

	const route = routes[u.pathname];
	if (route == undefined || route == null || req.method != route.Method || req.headers['content-type'] != route['Content-Type']) {
		log(`Route not found`);
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({
			'Error': 'Not found',
		}));
		return;
	}
	log(`Running Route ${u.path}`);
	route.Handler(req, res);
});




server.listen(port);
log(`Started Server on ${port}`);


