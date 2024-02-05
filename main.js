import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { GlitchPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/GlitchPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import TouchControls from './resources/controller/TouchControls.js'














let mainCamera;
let debugFactor = 0.5;
let BLOOM_SCENE = 1;
let loadProgress;


class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class BasicCharacterController {
  constructor(params) {
    this._Init(params);
  }

  _Init(params) {
    
    this.forward;
    this.material;
    this.animTexture;

    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 80.0);
    this._velocity = new THREE.Vector3(0, 0, 0);

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this._LoadModels();
    this._setupTouchControls();
  }

  _setupTouchControls()
  {
    const aspect = this._width / this._height;
    const viewAngle = 45
    const near = 1
    const far = 300
    const camera_mew = new THREE.PerspectiveCamera(viewAngle, aspect, near, far)
    const options = {
      delta: 0.75,           // coefficient of movement
      moveSpeed: 0.5,        // speed of movement
      rotationSpeed: 0.002,  // coefficient of rotation
      maxPitch: 55,          // max camera pitch angle
      hitTest: false,         // stop on hitting objects
      hitTestDistance: 40    // distance to test for hit
      }
      this._touchControls = new TouchControls(document.body, camera_mew, options);
      this._touchControls.movementPad.padElement.addEventListener('stopMove', (event) => {
        this._input._keys.forward = false;
        this._input._keys.shift = false;
      }); 
  }

  _LoadModels() {

    const texture = new THREE.TextureLoader().load('resources/glitch.jpg' );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.animTexture = document.getElementById( 'video' );
	  const videoTexture = new THREE.VideoTexture(this.animTexture);
    const loader = new FBXLoader();
    loader.setPath('./resources/zombie/');
    loader.load('mremireh_o_desbiens_my.fbx', (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
        c.layers.toggle(BLOOM_SCENE);
        if ( c.material )this.material = c.material;
        if ( c.material )c.material.emissiveMap = videoTexture;
        if ( c.material )c.material.map = videoTexture;
        if ( c.material )c.material.emissive = new THREE.Color( 0xff0000 );
      });

      this._target = fbx;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle');
        

      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);
  
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(this._manager);
      loader.setPath('./resources/zombie/');
      loader.load('walk.fbx', (a) => { _OnLoad('walk', a);this._params.level._loadProgress("walk") });
      loader.load('run.fbx', (a) => { _OnLoad('run', a);this._params.level._loadProgress("run") });
      loader.load('idle.fbx', (a) => { _OnLoad('idle', a);this._params.level._loadProgress("idle") });
      loader.load('StandingUp.fbx', (a) => { _OnLoad('dance', a);this._params.level._loadProgress("dance") });
      loader.load('Fall.fbx', (a) => { _OnLoad('fall', a);this._params.level._loadProgress("fall") });
    });
  }

  Update(timeInSeconds) {
    if (!this._target) {
      return;
    }

    this._touchControls.update();
    const touchDir = new THREE.Vector3(this._touchControls.velocity.x,0,-this._touchControls.velocity.z);
    const touchLen = touchDir.lengthSq()
    const touchActive = touchLen>0.01;
    const touchWalk = touchLen>0.12;
    const touchRun = touchLen>0.5;
    if(touchWalk)this._input._keys.forward = true;
    if(touchRun)this._input._keys.shift = true;

    this._stateMachine.Update(timeInSeconds, this._input);
    
    
    
    


    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();

    const acc = this._acceleration.clone();
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this._stateMachine._currentState.Name == 'dance') {
      acc.multiplyScalar(1.0);
    }

    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }

    //touchpad rotation
    if(touchActive){
    _R.setFromUnitVectors(touchDir.normalize(),new THREE.Vector3(0,0,1)).normalize()
    }
    
    
    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();


    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    this.forward = forward;

    oldPosition.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};

class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = true;
        break;
      case 65: // a
        this._keys.left = true;
        break;
      case 83: // s
        this._keys.backward = true;
        break;
      case 68: // d
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        break;
      case 16: // SHIFT
        this._keys.shift = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        this._keys.forward = false;
        break;
      case 65: // a
        this._keys.left = false;
        break;
      case 83: // s
        this._keys.backward = false;
        break;
      case 68: // d
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
    }
  }
};


class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('run', RunState);
    this._AddState('dance', DanceState);
    this._AddState('fall', FallState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};


class DanceState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'dance';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['dance'].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();  
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.SetState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['dance'].action;
    
    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(timeElapsed, input) {
  }
};

class FallState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'fall';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['fall'].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      //curAction.reset();
      mixer.stopAllAction()
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      //curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.timeScale = 1.0/debugFactor;
      curAction.play();
    } else {
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.timeScale = 1.0/debugFactor;
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    //gsap.to(mainCamera, { duration: 5, fov: 120 });
    this._parent.SetState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['fall'].action;
    
    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(timeElapsed, input) {
    if (input._keys.space) {
      this._parent.SetState('dance');      
    }
  }
};


class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk');
    } else if (input._keys.space) {
      this._parent.SetState('walk');
    }
  }
};



























































class CharacterControllerDemo {
  //renderpasses
  _glitchPass
  _glitchTimer = 0;
  _bloomLayer = new THREE.Layers();
	//updaterelated
  _prevPos = new THREE.Vector3(0,0,0);
  _gameMode = false;
  _animTextureGates = document.getElementById( 'video' );
  _locomotive;
  //bloompass
  _materials = {};
  _darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );
  //mixers
  _mixers = [];
  _cameraMixer;
  _questionMixer01;
  _gateTextMixer = [];
  _textAnimationMixer;
  //scene
  _camera;
  _scene = new THREE.Scene();
  _width = window.innerWidth;
  _height = window.innerHeight;
  _threejs = new THREE.WebGLRenderer({antialias: true,});
  //util
  _previousRAF = null;
  _listToDo;
  _toDoProgress=0+1;


  constructor() {
    this._Initialize();

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  _Initialize() {

    loadProgress = this._loadProgress;

    document.getElementById( 'startButton').style.display = "none";
    this._bloomLayer.set( BLOOM_SCENE );
    this._questionTimeline = gsap.timeline({
      paused:true, 
      defaults:{duration:12, scale:0}
    });

    
    
    
    
    this.cameraControls;
    this.u;

    
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(this._width, this._height); 

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    const fov = 60;
    this._aspect = window.innerWidth / window.innerHeight
    const near = 1.0;
    const far = 1000.0;
    this._cameraGame = new THREE.PerspectiveCamera(fov, this._aspect, near, far);
    this._cameraGame.position.set(0, 0, 0);

    this.cameraControls = new OrbitControls(
      this._cameraGame, this._threejs.domElement);
    this.cameraControls.target.set(0, 0, -150);
    this.cameraControls.update();
    
    
    this._scene.fog = new THREE.Fog( 0x1F1A27, 400, 1000);

    let light = new THREE.DirectionalLight(0xFFFFFF, 5.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this._scene.add(light);
    
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/posx.jpg',
        './resources/negx.jpg',
        './resources/posy.jpg',
        './resources/negy.jpg',
        './resources/posz.jpg',
        './resources/negz.jpg',
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this._scene.background = new THREE.Color( 0x1F1A27 );

    this._listToDo = ["env sky","env land","gates","textFall","GateText","Question","Camera",
                      "StateRun","StateWalk","StateDance","StateFall","StateIdle"];
    var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
    this._LoadParticleEnv();
    this._LoadParticleEnvSky();
    this._LoadGates();
    this._LoadTextFall();
    this._LoadGateText();
    this._LoadQuestion01Animation();
    this._LoadCamera();
    this._LoadInfoSphere();

    
    

   

  }

  _loadProgress(message){
    if(this._listToDo.length==this._toDoProgress){
      document.getElementById( 'startButton').style.display = "block";
      document.getElementById( 'startButton').addEventListener( 'click', this._levelStart.bind(this));
    }
    this._toDoProgress+=1;
    console.log(message);
  }


  _levelStart() {     
    document.body.addEventListener('click', this._progressAnimation.bind(this), true); 
    this._controls.animTexture.play();  
    this._questionTimeline.play();
    this._RAF();    
  }



  _bloomSetup() {



			const params = {
				exposure: 0.5,
				bloomStrength: 0.1,
				bloomThreshold: 3,
				bloomRadius: 10,
				scene: 'Scene with Glow'
			};

      const renderScene = new RenderPass( this._scene, this._camera );

      const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
		  bloomPass.threshold = 0;
			bloomPass.strength = 1.0;
			bloomPass.radius = 0;
      var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };

      var renderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, parameters );

      this._bloomComposer = new EffectComposer( this._threejs)
			this._bloomComposer.renderToScreen = false;
			this._bloomComposer.addPass( renderScene );
			this._bloomComposer.addPass( bloomPass );
      //this._bloomComposer.toneMappingExposure = 10;
      

      const finalPass = new ShaderPass(
				new THREE.ShaderMaterial( {
					uniforms: {
						baseTexture: { value: null },
						bloomTexture: { value: this._bloomComposer.renderTarget2.texture }
					},
					vertexShader: document.getElementById( 'vertexshader' ).textContent,
					fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
					defines: {}
				} ), 'baseTexture'
			);
			finalPass.needsSwap = true;

    this._finalComposer = new EffectComposer( this._threejs,renderTarget );
    this._finalComposer.addPass( renderScene );
    this._finalComposer.addPass( finalPass );
    this._glitchPass = new GlitchPass();

    //this._glitchPass.goWild = 1;
    //this._glitchPass.curF = 0;

    this._finalComposer.addPass( this._glitchPass );
  }


  
  
  _progressAnimation() {
    this._questionTimeline.play();  
  }


  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._locomotive,
      level: this,
    }
    this._controls = new BasicCharacterController(params);
  }

  _LoadAnimatedModelAndPlay(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      fbx.position.copy(offset);

      const anim = new FBXLoader();
      anim.setPath(path);
      anim.load(animFile, (anim) => {
        const m = new THREE.AnimationMixer(fbx);
        this._mixers.push(m);
        const idle = m.clipAction(anim.animations[0]);
        idle.play();
      });
      this._scene.add(fbx);
    });
  }


  _Finished() {
    this._gameMode = true;
    //gsap.to(this._camera, { duration: 10, fov: 120 });
    this._camera.updateProjectionMatrix();
    this._controls._stateMachine.SetState('dance');
  }

  _LoadQuestion01Animation() {    
    const loader = new GLTFLoader();
    loader.load('./resources/question01.glb', (gltf) => {    
      this._questionMixer01 = new THREE.AnimationMixer(gltf.scene);
      const questionAction01 = this._questionMixer01.clipAction(gltf.animations[0]);
      const action = questionAction01;
      action.play();
      action.paused = true;
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.enable = true;

      gltf.scene.traverse(c => {
        c.layers.toggle(BLOOM_SCENE);
      });

      
      
      this._questionTimeline
      .to(action, { duration: 5*debugFactor, time: 5,ease: "none"})
      .addPause()
      .to(action, { duration: 10*debugFactor, time: 15,ease: "none"})
      .addPause()
      .to(action, { duration: 5*debugFactor, time: 20,ease: "none"})
      .add( function(){ console.log('Woohoo!')})    
      this._scene.add(gltf.scene);  
    });
    this._loadProgress("question01");
  }

  _LoadGateText() {
    const textList = ["trade_wealth","gamble_luck","sex_lust","battle_fight", "power_control"]
    const loader = new FBXLoader();
    textList.forEach((filename ) => {
      
         
      
      loader.load('./resources/' + filename +'_text.fbx', (fbx) => {
        for ( var track in fbx.animations[ 0 ].tracks) {
          
          fbx.animations[ 0 ].tracks[track].setInterpolation (THREE.InterpolateDiscrete);
        }    
        const mixer = new THREE.AnimationMixer(fbx);
        
        fbx.animations.forEach( ( clip ) => {
        const action = mixer.clipAction(clip);
        action.play();  
        } );
      this._gateTextMixer.push(mixer);
      fbx.traverse(c => {
        c.layers.toggle(BLOOM_SCENE);
        if ( c.material )c.material.emissive = new THREE.Color( 0xcc002c );
      });
      this._scene.add(fbx); 
      });
      
    });
    this._loadProgress("gate_text");  
  }
  
  _LoadCamera() {
    
    const loader = new GLTFLoader();
    loader.load('./resources/out.glb', (fbx) => {
      this._locomotive = fbx.scene.getObjectByName('export_locomotive');
      fbx.scene.traverse(c => {
        
        if ( c instanceof THREE.Camera ) {
            this._camera=c;
            this._camera.aspect = this._aspect;
            this._camera.updateProjectionMatrix() 

        }
      });
      this._cameraMixer = new THREE.AnimationMixer(fbx.scene);
      const animation = fbx.animations[0];
      const action = this._cameraMixer.clipAction(animation );
      action.play();
      action.paused = true;
      action.setLoop(THREE.LoopOnce);
      //action.clampWhenFinished = true;
      action.enable = true;      
      mainCamera = this._camera;

      this._questionTimeline
      .add( function(){ this._controls._stateMachine.SetState('idle'); }.bind(this))
      .add( function(){ this._controls._stateMachine.SetState('fall'); }.bind(this))
      .to(action, { duration: animation.duration*debugFactor, time: animation.duration,ease: "none"})

      //.to(this._camera, { duration: 2, fov: 46 })
      .add( function(){ gsap.to(mainCamera, { duration: 2, fov: 40 }) }.bind(this),"-=4")
      .add( function(){ gsap.to(this.up02.atime, { duration: 3, value: 2 }) }.bind(this),"-=6")
      //.add( function(){ gsap.to(mainCamera, { duration: 2, fov: 40 }) }.bind(this),"-=1.5")
      //.add( function(){ gsap.to(this.up02.atime, { duration: 3, value: 2 }) }.bind(this),"-=2.5")
      .add( function(){ this._gameMode = true }.bind(this),"-=4")
      
      


      this._scene.add(fbx.scene);
      this._LoadAnimatedModel();
      this._bloomSetup();
   
    });
  this._loadProgress("camera"); 
  }

  _LoadTextFall() {
    const loader = new GLTFLoader();
    
    loader.load('./resources/white_text.glb', (gltf) => {
      gltf.scene.traverse(c => {
        c.castShadow = true;
        if ( c.material )c.material.emissive = new THREE.Color( 0xffffff );
      });
      this._scene.add(gltf.scene);

    });
    loader.load('./resources/black_text.glb', (gltf) => {

      this._scene.add(gltf.scene);
    });
    this._loadProgress("text_fall");
  }

  _LoadInfoSphere() {
    const loader = new GLTFLoader();
    
    let m = new THREE.ShaderMaterial( {
    
      uniforms: {
        tExplosion: {
          type: "t",
          value: new THREE.TextureLoader().load('./resources/explosion.png' ),
        },
        time: { // float initialized to 0
          type: "f",
          value: 0.0
        }
      },
      vertexShader: document.getElementById( 'vertexShader1' ).textContent,
      fragmentShader: document.getElementById( 'fragmentShader1' ).textContent
    
    } );
    this.up03 = m.uniforms;
    

    loader.load('./resources/sphere.glb', (gltf) => {
      gltf.scene.traverse(c => {        
        if ( c.material )c.material = m;
        c.layers.toggle(BLOOM_SCENE); 
      });
      this._scene.add(gltf.scene);
    });
  }
  
  _LoadGates() {
    const loader = new GLTFLoader();
    
    loader.load('./resources/gates.glb', (gltf) => {
    
      const videoTexture = new THREE.VideoTexture(this._animTextureGates);
      gltf.scene.traverse(c => {
        c.castShadow = true;
        c.layers.toggle(BLOOM_SCENE); 
        if ( c.material )c.material.emissiveMap = videoTexture;
        if ( c.material )c.material.map = videoTexture;
        if ( c.material )c.material.emissive = new THREE.Color( 0xff0000 );
      });
      this._scene.add(gltf.scene);
    });
    this._loadProgress("gates");
  }
  
  _LoadParticleEnvSky() {
    const loader = new GLTFLoader();

    

    //const material = new THREE.PointsMaterial( { color: 0x888888 } );
    loader.load('./resources/sky.glb', (gltf) => {
      let u = {
        utime: {value: 192.54},
        wPos: {value: new THREE.Vector3(0,0,0)},
        lightPos: {value: new THREE.Vector3()}
      }
      let m = new THREE.PointsMaterial({
        size: 1.0, 
        color: 0xF0EED2,
        map: new THREE.TextureLoader().load("https://threejs.org/examples/textures/sprites/circle.png"),
        onBeforeCompile: shader => {
          shader.uniforms.utime = u.utime;
          shader.uniforms.wPos = u.wPos;
          shader.vertexShader = `
            uniform float utime; // just the force of habit to add it :)
            uniform vec3 lightPos;
            uniform vec3 wPos;
            varying float vShade;
            
            ${simplexNoise}
            
            float map(float value, float min1, float max1, float min2, float max2) {
              return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
            }
            
            vec3 getPoint(vec3 p){
              float mutime = utime*(snoise( p*1000.0)+1.0)*10000.0;
              float fqq = 1000.0;
              float mod = mutime - fqq * floor(mutime * (1.0/fqq));
              float map01 = map(distance(wPos, position),50.0,500.0,0.7,0.0);
              float map02 = clamp(map(distance(wPos, position),50.0,500.0,0.0,300.0),0.0,1.0);
              float map03 = clamp(map(distance(wPos, position),100.0,400.0,0.0,300.0),0.0,2.0);
              float map04 = clamp(map(distance(wPos, position),150.0,300.0,0.0,300.0),0.0,2.0);

              return p + vec3(0.0, mod,0.0);
              
            }
            
            ${shader.vertexShader}
          `.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
              
              vec3 p0 = getPoint(position);
              
              transformed = p0;
            `
          ).replace(
            `gl_PointSize = size;`,
            `gl_PointSize = size;`
          );
        }
      });

      this.up01 = u;

      gltf.scene.traverse(c => {
        c.castShadow = true;
        c.material = m;
      });
      this._scene.add(gltf.scene.clone());
      //gltf.scene.position.add(new THREE.Vector3(0,-3,0));  
      this._scene.add(gltf.scene);
    });
    this._loadProgress("land_particles");
  }

  _LoadParticleEnv() {
    const loader = new GLTFLoader();

    

    //const material = new THREE.PointsMaterial( { color: 0x888888 } );
    loader.load('./resources/land.glb', (gltf) => {
      let u = {
        utime: {value: 192.54},
        atime: {value: 0.5},
        wPos: {value: new THREE.Vector3(0,0,0)},
        lightPos: {value: new THREE.Vector3()}
      }
      let m = new THREE.PointsMaterial({
        size: 1.0, 
        color: 0xF0EED2,
        map: new THREE.TextureLoader().load("https://threejs.org/examples/textures/sprites/circle.png"),
        onBeforeCompile: shader => {
          shader.uniforms.utime = u.utime;
          shader.uniforms.atime = u.atime;
          shader.uniforms.wPos = u.wPos;
          shader.vertexShader = `
            uniform float utime;
            uniform float atime; // just the force of habit to add it :)
            uniform vec3 lightPos;
            uniform vec3 wPos;
            varying float vShade;
            
            ${simplexNoise}
            
            float map(float value, float min1, float max1, float min2, float max2) {
              return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
            }
            
            vec3 getPoint(vec3 p){
              float dist = distance(wPos, position);
              float mod = (utime*20.0)-(floor((utime*20.0)/(1.5))*(1.5));
              float dist_anim = length(position)-atime*300.0;
              float map01 = map(dist,50.0,500.0,0.7,0.0);
              float map02 = clamp(map(dist+snoise( p*0.005 + utime*20.98)*10.0,50.0,500.0,0.0,30.0),0.0,20.0);
              float map03 = clamp(map(dist+snoise( p*0.01 + utime*10.98)*30.0,100.0,400.0,0.0,100.0),0.0,4.0);
              float map04 = clamp(map(dist+snoise( p*0.25 + utime*1.98)*30.0,150.0,300.0,0.0,300.0),0.0,5.0);
              float anim01 = (clamp(map(dist_anim,-100.0,0.0,0.0,1.0),0.0,1.0)*clamp(map(dist_anim,-100.0,0.0,1.0,0.0),0.0,1.0))*100.0;

              return p +
              vec3(0,snoise( p*0.008 + utime )*10.0*clamp(map(distance(wPos, position),0.0,200.0,0.0,1.0),0.0,1.0),0)+
              vec3(
              0,
                clamp(map(snoise( p*10.0 + utime*1.98 ),map01,1.0,0.0,1.0),0.0,1.0)*30.0*  
                clamp(map(distance(wPos, position),0.0,200.0,0.0,1.0),0.0,1.0) + map01 + map02 - map03 + map04 + anim01
              ,0);
            }
            
            ${shader.vertexShader}
          `.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
              
              vec3 p0 = getPoint(position);
              
              transformed = p0;
            `
          ).replace(
            `gl_PointSize = size;`,
            `gl_PointSize = size;`
          );
        }
      });
      
      this.up02 = u;

      gltf.scene.traverse(c => {
        c.castShadow = true;
        c.material = m;
      });
      this._scene.add(gltf.scene.clone());
      //gltf.scene.position.add(new THREE.Vector3(0,-3,0));  
      this._scene.add(gltf.scene);
    });
    this._loadProgress("sky _particles");
  }

  _LoadModel() {
    const loader = new GLTFLoader();
    
    loader.load('./resources/thing.glb', (gltf) => {
      gltf.scene.traverse(c => {
        c.castShadow = true;
        c.material = material
      });
      this._scene.add(gltf.scene);
    });
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _renderBloom() {
      this._scene.traverse(obj => {
        if(this._bloomLayer.test( obj.layers ) === false){
          this._materials[ obj.uuid ] = obj.material;
          obj.material = this._darkMaterial;
        }
      });
      this._bloomComposer.render();
      this._scene.traverse(obj => {
        if ( this._materials[ obj.uuid ] ) {
          obj.material = this._materials[ obj.uuid ];
          delete this._materials[ obj.uuid ];
        }
      });
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {

    //this._glitchTimer +=timeElapsed;
    //console.log(this._glitchPass.uniforms);
    //this._glitchPass.curF = this._glitchTimer*0.001*10;
    //this._glitchPass.uniforms.amount.value=0.00001;
    //this._glitchPass.uniforms.distortion_x.value=0.00001;
    //this._glitchPass.uniforms.distortion_y.value=0.00001;
    //this._glitchPass.uniforms.col_s.value=0.0001;
    //this._glitchPass.uniforms.angle.value=0.0001;
    //this._glitchPass.uniforms.byp.value=0.0001;
    


    

    this._renderBloom();
    
    
    const currPos = this._controls._target.getWorldPosition(new THREE.Vector3());
    
    this._questionMixer01.update(timeElapsed*0.001);
    this._cameraMixer.update(timeElapsed*0.001);
    //this._textAnimationMixer.update(timeElapsed*0.001);
    this._camera.position.copy(this._cameraGame.position)
    this._camera.rotation.copy(this._cameraGame.rotation)
    this._camera.updateProjectionMatrix() 
    //this.composer.render();  
    //this.cameraControls.target.set(0, 10, 0);
    if(this._gameMode){
      this.cameraControls.target.add(this._prevPos.clone().sub(currPos));
      this.cameraControls.object.position.add(this._prevPos.clone().sub(currPos));
    }
    this.cameraControls.update();

    
    
    this._prevPos = currPos;
    //this.cameraControls.object.position.add(this._controls.forward);
    //this.cameraControls.object.position.add(this._controls._velocity);
    //this.cameraControls.update();
    //this._camera.position.set(25, 10, 25);
    //this._camera.position.add(this._controls._target.getWorldPosition(new THREE.Vector3()));
    this.up01.wPos.value = this._controls._target.getWorldPosition(new THREE.Vector3());
    this.up01.utime.value+=timeElapsed*0.00001;

    this.up02.wPos.value = this._controls._target.getWorldPosition(new THREE.Vector3());
    this.up02.utime.value+=timeElapsed*0.00001;
    console.log(this.up03);
    this.up03.time.value+=timeElapsed*0.0001;
    
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._gateTextMixer) {
      this._gateTextMixer.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }
  this._finalComposer.render(this._scene, this._camera.object);
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new CharacterControllerDemo();
});
