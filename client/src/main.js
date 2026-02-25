import { addRoute, startRouter } from './router.js';
import { renderNetList } from './views/net-list.js';
import { renderNetDetail } from './views/net-detail.js';
import { renderPastNets, renderPastNetDetail } from './views/past-nets.js';

addRoute('/', (container) => renderNetList(container));
addRoute('/net/:serverName/:netName', (container, params) => renderNetDetail(container, params));
addRoute('/past', (container) => renderPastNets(container));
addRoute('/past/:serverName/:netName/:netId', (container, params) => renderPastNetDetail(container, params));

startRouter();
