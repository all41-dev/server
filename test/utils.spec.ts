import * as chai from 'chai';
import { Utils } from '../src/utils';
import { DateTime } from 'luxon';

describe('Utils class', () => {
  describe('dateToDateTime', () => {
    it('Simple', (done) => {
      const obj = {
        myDate: new Date()
      };

      Utils.inst.dateToDateTime(obj);

      chai.expect(obj.myDate).to.instanceOf(DateTime)
      done();
    }).timeout(0);
    it('Imbricated', (done) => {
      const obj = {
        subObj: {
          myDate: new Date()
        }
      };

      Utils.inst.dateToDateTime(obj);

      chai.expect(obj.subObj.myDate).to.instanceOf(DateTime)
      done();
    }).timeout(0);
    it('Array', (done) => {
      const obj = [{
        myDate: new Date()
      }];

      Utils.inst.dateToDateTime(obj);

      chai.expect(obj[0].myDate).to.instanceOf(DateTime)
      done();
    }).timeout(0);
    it('Array prop', (done) => {
      const obj = {
        subObj: [{
          myDate: new Date()
        }],
      };

      Utils.inst.dateToDateTime(obj);

      chai.expect(obj.subObj[0].myDate).to.instanceOf(DateTime)
      done();
    }).timeout(0);
    it('Array of Dates', (done) => {
      const obj = {
        subObj: [
          new Date()
        ],
      };

      Utils.inst.dateToDateTime(obj);

      chai.expect(obj.subObj[0]).to.instanceOf(DateTime)
      done();
    }).timeout(0);
    it('Array of Objects', (done) => {
      const obj = {
        subObj: [
          new Date()
        ],
      };

      Utils.inst.dateToDateTime(obj);

      chai.expect(obj.subObj[0]).to.instanceOf(DateTime)
      done();
    }).timeout(0);
  });
});
