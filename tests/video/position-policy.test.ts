import assert from 'node:assert/strict';
import test from 'node:test';
import {videoSaveInterval,validVideoRef,validPositionBody,preferredVideoRate,storeVideoRate,shouldOfferResume,type VideoPosition} from '../../lib/video-position';
const body={kind:'lesson',id:1,viewerId:'owner',videoVersion:'mux:FixedPlayback',revision:0,sessionId:'f4000000-0000-4000-8000-000000000001',sequence:1,positionSeconds:10,durationSeconds:100};
test('resume input rejects invalid parents, timestamps, transient tokens and sequence/revision values',()=>{
 assert.deepEqual(validVideoRef('update','42'),{kind:'update',id:42});assert.equal(validVideoRef('lesson','1.5'),null);assert.ok(validPositionBody(body));
 for(const patch of [{kind:'unknown'},{id:-1},{id:1.5},{positionSeconds:NaN},{durationSeconds:Infinity},{positionSeconds:101},{positionSeconds:-1},{durationSeconds:0},{videoVersion:'mux:ey.example.jwt'},{revision:-1},{sequence:0},{sessionId:'invalid'}])assert.ok(!validPositionBody({...body,...patch}),JSON.stringify(patch));
});
test('95 is a presentation threshold: completed positions do not offer an automatic end-of-video resume',()=>{
 const position={viewerId:'owner',videoVersion:'mux:Fixed',revision:1,positionSeconds:45,durationSeconds:100,maxPositionSeconds:45,completed:false}as VideoPosition;
 assert.equal(shouldOfferResume(position),true);assert.equal(shouldOfferResume({...position,positionSeconds:3}),false);assert.equal(shouldOfferResume({...position,positionSeconds:95}),false);assert.equal(shouldOfferResume({...position,completed:true}),false);
});
test('speed preferences are scoped by user, constrained to supported rates and tolerate storage denial',()=>{
 const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)};
 storeVideoRate(storage,'a',0.5);assert.equal(preferredVideoRate(storage,'a'),0.5);assert.equal(preferredVideoRate(storage,'b'),1);storeVideoRate(storage,'a',1.2);assert.equal(preferredVideoRate(storage,'a'),0.5);
 const blocked={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};assert.equal(preferredVideoRate(blocked,'a'),1);assert.doesNotThrow(()=>storeVideoRate(blocked,'a',0.75));
});

test('periodic saving stays at ten seconds or less of media time, including 2x playback',()=>{assert.equal(videoSaveInterval(1),10000);assert.equal(videoSaveInterval(0.5),10000);assert.equal(videoSaveInterval(2),5000);assert.equal(videoSaveInterval(NaN),10000);});
