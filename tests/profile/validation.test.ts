import assert from "node:assert/strict";
import test from "node:test";
import {normalizeProfileName,normalizeProfilePhone,profileIsComplete,profileReturnTo,profileCompletionUrl,greetingFirstName} from "../../lib/profile";

test("real names survive normalization without inventing an identity",()=>{
 for(const input of [null,"","  ","Onbekend"," UNKNOWN ","1234","Alice\u200b"])assert.equal(normalizeProfileName(input),null);
 for(const input of ["Élodie","李","O'Neill","van den Berg"])assert.equal(normalizeProfileName(input),input);
 assert.equal(normalizeProfileName("  Ward   Janssen  "),"Ward Janssen");assert.equal(normalizeProfileName("x".repeat(101)),null);
 assert.equal(greetingFirstName("rous"),"Rous");assert.equal(greetingFirstName("éLODIE Janssen"),"ÉLODIE");
});

test("BE, NL and international numbers normalize without interpreting arbitrary text as a number",()=>{
 assert.equal(normalizeProfilePhone("0470 12 34 56","BE"),"+32470123456");
 assert.equal(normalizeProfilePhone("06 12345678","NL"),"+31612345678");
 assert.equal(normalizeProfilePhone("0032 470 12 34 56"),"+32470123456");
 assert.equal(normalizeProfilePhone("+44 20 7946 0018","international"),"+442079460018");
 for(const value of ["", "123", "call +32470123456", "+32470123456 ext 4","+1234567890123456789"])assert.equal(normalizeProfilePhone(value),null);
 assert.equal(normalizeProfilePhone("02079460018","international"),null);
 assert.equal(profileIsComplete({name:"Onbekend",phone:"+32470123456"}),false);
 assert.equal(profileIsComplete({name:"Ward",phone:null}),false);
 assert.equal(profileIsComplete({name:"Ward",phone:"+32470123456"}),true);
});

test("completion preserves safe content context without an auth/profile/API loop",()=>{
 assert.equal(profileReturnTo("/modules/intro?lesson=2#notes"),"/modules/intro?lesson=2#notes");
 for(const path of [null,"//evil.example","https://evil.example","/\\evil","/api/documents/1","/auth/confirm?token_hash=secret","/profile-completion?next=/profile-completion","/update-password","/account/update-password","/"])assert.equal(profileReturnTo(path),"/dashboard");
 assert.equal(profileCompletionUrl("/mentor-inbox?thread=one"),"/profile-completion?next=%2Fmentor-inbox%3Fthread%3Done");
});
