'use strict';

/**
 * ZAI Communication Engine — Barrel Principal
 */

const zaiCommunicationEngine = require('./ZAICommunicationEngine');
const protocolIntelligence = require('./ProtocolIntelligence');
const compatibilityEngine = require('./CompatibilityEngine');

zaiCommunicationEngine.zai = zaiCommunicationEngine;
zaiCommunicationEngine.protocolIntelligence = protocolIntelligence;
zaiCommunicationEngine.compatibilityEngine = compatibilityEngine;

module.exports = zaiCommunicationEngine;
