import Repositories from '../repositories/_repositories.ts';
import Services from './_services.ts';

abstract class BaseService {
 services: Services;
 repos: Repositories;

 constructor(services: Services, repositories: Repositories) {
  this.services = services;
  this.repos = repositories;
 }
}

export default BaseService;
