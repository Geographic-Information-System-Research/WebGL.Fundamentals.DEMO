
/* global hljs, gl */

//'use strict';

import * as twgl from '../3rdparty/twgl-full.module.js';
import {
  addElem,
  flash,
  removeFlashes,
} from './utils.js';
import { getStateTables } from './state-tables.js';
import {
  addWebGLObjectInfo,
  getWebGLObjectInfo,
  setDefaultVAOInfo,
  getWebGLObjectInfoOrDefaultVAO,
} from './context-wrapper.js';
import {
  makeDraggable,
  moveToFront,
  setWindowPositions,
  setHint,
  setHintSubs,
  showHint,
} from './ui.js';

import Stepper from './stepper.js';
import {arrowManager} from './arrows.js';
import {
  isBadWebGL2,
  init as initWebGL,
} from './webgl.js';
import {
  globals,
} from './globals.js';
import {
  createShaderDisplay,
  createProgramDisplay,
} from './program-ui.js';
import {
  createSamplerDisplay,
  createTextureDisplay,
} from './texture-ui.js';
import {
  createBufferDisplay,
  createFramebufferDisplay,
  createRenderbufferDisplay,
} from './buffer-ui.js';
import {
  createVertexArrayDisplay,
} from './vertex-array-ui.js';
import { createGlobalUI } from './global-ui.js';

export default function main({webglVersion, examples}) {
  globals.isWebGL2 = webglVersion === 'webgl2';
  const isWebGL2 = globals.isWebGL2;

  hljs.initHighlightingOnLoad();

  gl = document.querySelector('canvas').getContext(webglVersion, {preserveDrawingBuffer: true});  /* eslint-disable-line */
  if (!gl || (isWebGL2 && isBadWebGL2(gl))) {
    document.body.classList.add('no-webgl');
    return;
  }

  twgl.addExtensionsToContext(gl);

  globals.renderTexture = initWebGL(gl).renderTexture;
  globals.executeWebGLWrappers = true;

  const defaultExampleId = Object.keys(examples)[0];
  const search = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(search.entries());
  let {lang, exampleId = defaultExampleId} = params;
  setHintSubs({
    langPathSegment: lang ? `${lang}/` : '',
  });

  if (!examples[exampleId]) {
    exampleId = defaultExampleId;
  }
  const example = examples[exampleId];
  setWindowPositions(example.windowPositions);

  const examplesElem = document.querySelector('#example');
  for (const [id, example] of Object.entries(examples)) {
    addElem('option', examplesElem, {
      textContent: example.name,
      value: id,
      ...id === exampleId && {selected: true},
    });
  }
  examplesElem.addEventListener('change', (e) => {
    search.set('exampleId', e.target.value);
    const url = new URL(location.href);
    url.hash = '#no-help';
    url.search = search.toString();
    location.href = url.href;
  });

  globals.stateTables = getStateTables(isWebGL2);

  const diagramElem = document.querySelector('#diagram');
  const codeElem = document.querySelector('#code');
  const stepper = new Stepper();

  document.body.addEventListener('click', showHint);

  const defaultVAOInfo = {
    ui: createVertexArrayDisplay(diagramElem, '*default*', null),
  };
  setDefaultVAOInfo(defaultVAOInfo);

  globals.globalUI = createGlobalUI(document.querySelector('#global-state'));
  const canvasDraggable = makeDraggable(document.querySelector('#canvas'));
  moveToFront(defaultVAOInfo.ui.elem.parentElement);
  arrowManager.update();

  function wrapFn(fnName, fn) {
    gl[fnName] = function(origFn) {
      if (!origFn) {
        throw new Error(`unknown function:${fnName}`);
      }
      return function(...args) {
        if (globals.executeWebGLWrappers) {
          return fn.call(this, origFn, ...args);
        } else {
          return origFn.call(this, ...args);
        }
      };
    }(gl[fnName]);
  }

  function wrapCreationFn(fnName, uiFactory) {
    wrapFn(fnName, function(origFn, ...args) {
      const webglObject = origFn.call(this, ...args);
      const name = stepper.guessIdentifierOfCurrentLine();
      addWebGLObjectInfo(webglObject, {
        name,
        ui: uiFactory(name, webglObject),
      });
      return webglObject;
    });
  }

  function wrapDeleteFn(fnName) {
    wrapFn(fnName, function(origFn, webglObject) {
      origFn.call(this, webglObject);
      const info = getWebGLObjectInfo(webglObject);
      info.deleted = true;
      const {elem} = info.ui;
      elem.remove();
    });
  }

  wrapCreationFn('createTexture', (name, webglObject) => {
    return createTextureDisplay(diagramElem, name, webglObject);
  });
  wrapCreationFn('createBuffer', (name, webglObject) => {
    return createBufferDisplay(diagramElem, name, webglObject);
  });
  wrapCreationFn('createShader', (name, webglObject) => {
    return createShaderDisplay(diagramElem, name, webglObject);
  });
  wrapCreationFn('createProgram', (name, webglObject) => {
    return createProgramDisplay(diagramElem, name, webglObject);
  });
  wrapCreationFn('createVertexArray', (name, webglObject) => {
    return createVertexArrayDisplay(diagramElem, name, webglObject);
  });
  wrapCreationFn('createFramebuffer', (name, webglObject) => {
    return createFramebufferDisplay(diagramElem, name, webglObject);
  });
  wrapCreationFn('createRenderbuffer', (name, webglObject) => {
    return createRenderbufferDisplay(diagramElem, name, webglObject);
  });
  wrapDeleteFn('deleteTexture');
  wrapDeleteFn('deleteBuffer');
  wrapDeleteFn('deleteShader');
  wrapDeleteFn('deleteProgram');
  wrapDeleteFn('deleteVertexArray');
  wrapDeleteFn('deleteFramebuffer');
  wrapDeleteFn('deleteRenderbuffer');

  for (const [fnName, stateUpdaters] of Object.entries(globals.globalUI.settersToWrap)) {
    wrapFn(fnName, function(origFn, ...args) {
      origFn.call(this, ...args);
      stateUpdaters.forEach(updater => updater());
    });
  }

  Object.keys(WebGLRenderingContext.prototype)
      .filter(name => /^uniform(\d|Matrix)/.test(name))
      .forEach((fnName) => {
        wrapFn(fnName, function(origFn, ...args) {
          origFn.call(this, ...args);
          const program = gl.getParameter(gl.CURRENT_PROGRAM);
          const {ui} = getWebGLObjectInfo(program);
          ui.updateUniforms();
        });
      });

  wrapFn('bindTexture', function(origFn, target, texture) {
    origFn.call(this, target, texture);
    const info = getWebGLObjectInfo(texture);
    if (!info.target) {
      info.target = target;
      info.ui.updateState(true);
    }
    globals.globalUI.textureUnits.updateCurrentTextureUnit(target);
  });
  function getCurrentTextureForTarget(target) {
    if (target === gl.TEXTURE_CUBE_MAP) {
      return gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP);
    }
    if (target === gl.TEXTURE_2D) {
      return gl.getParameter(gl.TEXTURE_BINDING_2D);
    }
    throw new Error(`unknown target: ${target}`);
  }
  wrapFn('texParameteri', function(origFn, target, ...args) {
    origFn.call(this, target, ...args);
    const texture = getCurrentTextureForTarget(target);
    const {ui} = getWebGLObjectInfo(texture);
    ui.updateState();
  });
  wrapFn('texImage2D', function(origFn, target, ...args) {
    origFn.call(this, target, ...args);
    const texture = getCurrentTextureForTarget(target);
    const {ui} = getWebGLObjectInfo(texture);
    ui.updateMip(target, ...args);
  });
  wrapFn('generateMipmap', function(origFn, target) {
    origFn.call(this, target);
    const texture = getCurrentTextureForTarget(target);
    const {ui} = getWebGLObjectInfo(texture);
    ui.generateMips(target);
  });

  if (globals.isWebGL2) {
    wrapCreationFn('createSampler', (name, webglObject) => {
      return createSamplerDisplay(diagramElem, name, webglObject);
    });
    wrapDeleteFn('deleteSampler');
    wrapFn('bindSampler', function(origFn, unit, sampler) {
      origFn.call(this, unit, sampler);
      globals.globalUI.textureUnits.updateTextureUnitSampler(unit);
    });
    wrapFn('samplerParameteri', function(origFn, sampler, ...args) {
      origFn.call(this, sampler, ...args);
      const {ui} = getWebGLObjectInfo(sampler);
      ui.updateState();
    });
    wrapFn('drawBuffers', function(origFn, ...args) {
      origFn.call(this, ...args);
      const framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      if (framebuffer) {
        const {ui} = getWebGLObjectInfo(framebuffer);
        ui.updateState();
      } else {
        globals.globalUI.drawBuffersState.updateState();
      }
    });
  }

  wrapFn('shaderSource', function(origFn, shader, source) {
    origFn.call(this, shader, source);
    const {ui} = getWebGLObjectInfo(shader);
    ui.updateSource();
  });

  wrapFn('attachShader', function(origFn, program, shader) {
    origFn.call(this, program, shader);
    const {ui} = getWebGLObjectInfo(program);
    ui.updateAttachedShaders();
  });
  wrapFn('detachShader', function(origFn, program, shader) {
    origFn.call(this, program, shader);
    const {ui} = getWebGLObjectInfo(program);
    ui.updateAttachedShaders();
  });

  wrapFn('compileShader', function(origFn, shader) {
    origFn.call(this, shader);
    const {ui} = getWebGLObjectInfo(shader);
    ui.updateState();
  });

  wrapFn('linkProgram', function(origFn, program) {
    origFn.call(this, program);
    const {ui} = getWebGLObjectInfo(program);
    ui.updateState();
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      ui.scanAttributes();
      ui.scanUniforms();
    }
  });
  wrapFn('bindBuffer', function(origFn, bindPoint, buffer) {
    origFn.call(this, bindPoint, buffer);
    if (bindPoint === gl.ARRAY_BUFFER) {
      globals.globalUI.commonState.updateState();
    } else {
      const {ui} = getCurrentVAOInfo();
      ui.updateState();
    }
  });
  wrapFn('bufferData', function(origFn, bindPoint, dataOrSize, hint) {
    origFn.call(this, bindPoint, dataOrSize, hint);
    const buffer = gl.getParameter(bindPoint === gl.ARRAY_BUFFER ? gl.ARRAY_BUFFER_BINDING : gl.ELEMENT_ARRAY_BUFFER_BINDING);
    const {ui} = getWebGLObjectInfo(buffer);
    ui.updateData(dataOrSize);
  });
  function getCurrentVAOInfo() {
    const vertexArray = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    return getWebGLObjectInfoOrDefaultVAO(vertexArray);
  }
  wrapFn('enableVertexAttribArray', function(origFn, ...args) {
    origFn.call(this, ...args);
    const {ui} = getCurrentVAOInfo();
    ui.updateAttributes();
  });
  wrapFn('disableVertexAttribArray', function(origFn, ...args) {
    origFn.call(this, ...args);
    const {ui} = getCurrentVAOInfo();
    ui.updateAttributes();
  });
  wrapFn('vertexAttribPointer', function(origFn, ...args) {
    origFn.call(this, ...args);
    const {ui} = getCurrentVAOInfo();
    ui.updateAttributes();
  });
  wrapFn('activeTexture', function(origFn, unit) {
    origFn.call(this, unit);
    globals.globalUI.textureUnits.updateActiveTextureUnit();
  });
  function updateProgramAttributesAndUniforms(prog) {
    if (prog) {
      const info = getWebGLObjectInfo(prog);
      info.ui.updateAttributes();
      info.ui.updateUniforms();
    }
  }
  wrapFn('bindVertexArray', function(origFn, vao) {
    origFn.call(this, vao);
    const {ui} = getCurrentVAOInfo();
    moveToFront(ui.elem);
    updateProgramAttributesAndUniforms(gl.getParameter(gl.CURRENT_PROGRAM));
  });
  wrapFn('useProgram', function(origFn, vao) {
    const oldProg = gl.getParameter(gl.CURRENT_PROGRAM);
    origFn.call(this, vao);
    const newProg = gl.getParameter(gl.CURRENT_PROGRAM);
    updateProgramAttributesAndUniforms(oldProg);
    updateProgramAttributesAndUniforms(newProg);
  });

  wrapFn('renderbufferStorage', function(origFn, target, ...args) {
    origFn.call(this, target, ...args);
    const renderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING);
    const {ui} = getWebGLObjectInfo(renderbuffer);
    ui.updateStorage(target);
  });
  function updateFramebufferAttachments(target) {
    const framebuffer = gl.getParameter(target === gl.FRAMEBUFFER ? gl.FRAMEBUFFER_BINDING : gl.READ_FRAMEBUFFER_BINDING);
    const {ui} = getWebGLObjectInfo(framebuffer);
    ui.updateAttachments(target);
  }
  wrapFn('framebufferRenderbuffer', function(origFn, target, ...args) {
    origFn.call(this, target, ...args);
    updateFramebufferAttachments(target);
  });
  wrapFn('framebufferTexture2D', function(origFn, target, ...args) {
    origFn.call(this, target, ...args);
    updateFramebufferAttachments(target);
  });
  wrapFn('bindFramebuffer', function(origFn, target, framebuffer) {
    origFn.call(this, target, framebuffer);
    if (framebuffer) {
      const info = getWebGLObjectInfo(framebuffer);
      if (!info.boundOnce) {
        info.boundOnce = true;
        info.ui.firstBind(target);
      }
    }
  });

  function wrapDrawFn(fnName) {
    wrapFn(fnName, function(origFn, ...args) {
      origFn.call(this, ...args);
      const framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      if (framebuffer) {
        const {ui} = getWebGLObjectInfo(framebuffer);
        ui.updateAttachmentContents(gl.FRAMEBUFFER);
      } else {
        flash(canvasDraggable.querySelector('.name'));
      }
    });
  }
  wrapDrawFn('clear');
  wrapDrawFn('drawArrays');
  wrapDrawFn('drawElements');
  wrapDrawFn('drawArraysInstanced');
  wrapDrawFn('drawElementsInstanced');

  function handleResizes() {
    arrowManager.update();
  }

  function afterStep() {
    arrowManager.update();
    removeFlashes();
  }

  function showHelp() {
    setHint({
       type: 'click',
      },
      document.querySelector('#docs-start').text);
  }

  /*
  const apiInfo = {
    'createShader': { help: `
    `},
    'shaderSource': { help: `
    `},
    'compileShader': { help: `
    `},
    'getShaderParameter': { help: `
    `},
    'createProgram': { help: `
    `},
    'attachShader': { help: `
    `},
    'linkProgram': { help: `
    `},
    'getProgramParameter': { help: `
    `},
    'deleteShader': { help: `
    `},
    'getAttribLocation': { help: `
    `},
    'getUniformLocation': { help: `
    `},
    'createBuffer': { help: `
    `},
    'bindBuffer': { help: `
    `},
    'bufferData': { help: `
    `},
    'createTexture': { help: `
    `},
    'bindTexture': { help: `
    `},
    'texImage2D': { help: `
    `},
    'texParameteri': { help: `
    `},
    'viewport': { help: `
    `},
    'clearColor': { help: `
    `},
    'clear': { help: `
    `},
    'enable': { help: `
    `},
    'enableVertexAttribArray': { help: `
    `},
    'vertexAttribPointer': { help: `
    `},
    'useProgram': { help: `
    `},
    'activeTexture': { help: `
    `},
    'uniform1i': { help: `
    `},
    'uniform3fv': { help: `
    `},
    'uniformMatrix4fv': { help: `
    `},
    'drawElement': { help: `
    `},
  };
  */

  function showLineHelp(/*line*/) {
    // console.log(line);
  }

  stepper.init(codeElem, document.querySelector(`#${exampleId}`).text, {
    onAfter: afterStep,
    onHelp: showHelp,
    onLine: showLineHelp,
  });
  if (window.location.hash.indexOf('no-help') < 0) {
    showHelp();
  }


  window.addEventListener('resize', handleResizes);
}
