import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'; import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'; import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'; import { PrismaService } from './prisma.service'; import { JwtAuthGuard } from './auth';
class CreateStory { @IsString() @MaxLength(140) title!:string; @IsOptional() @IsString() body?:string; @IsOptional() @IsString() audioUrl?:string; @IsString() genre!:string; @IsIn(['TEXT','AUDIO']) creationType!: 'TEXT'|'AUDIO'; @IsOptional() @IsInt() @Min(1) @Max(90) durationSeconds?:number; @IsOptional() @IsBoolean() premium?:boolean; }
export class StoriesService { constructor(private db:PrismaService){}
 private include={author:{select:{name:true,username:true,avatarUrl:true}},_count:{select:{likes:true,comments:true}}};
 trending(){return this.db.story.findMany({take:10,where:{status:'PUBLISHED',visibility:'PUBLIC'},include:this.include,orderBy:[{readCount:'desc'},{createdAt:'desc'}]})}
 mine(authorId:string){return this.db.story.findMany({where:{authorId},include:this.include,orderBy:{updatedAt:'desc'}})}
 async list(cursor?:string,q?:string){const items=await this.db.story.findMany({take:21,...(cursor?{skip:1,cursor:{id:cursor}}:{}),where:{status:'PUBLISHED',visibility:'PUBLIC',...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{tags:{has:q}}]}:{})},include:this.include,orderBy:{createdAt:'desc'}});return {data:items.slice(0,20),nextCursor:items.length>20?items[20].id:null};}
 one(id:string){return this.db.story.update({where:{id},data:{readCount:{increment:1}},include:this.include})}
 async create(authorId:string,d:CreateStory){const user=await this.db.user.findUniqueOrThrow({where:{id:authorId}});const count=await this.db.story.count({where:{authorId,createdAt:{gte:new Date(new Date().getFullYear(),new Date().getMonth(),1)}}}); if(user.subscriptionTier==='FREE'&&count>=5) throw new Error('Free plan monthly story limit reached'); return this.db.story.create({data:{...d,authorId,status:'PUBLISHED',visibility:'PUBLIC',tags:[d.genre],refinementStatus:d.creationType==='AUDIO'?'QUEUED':'NOT_REQUESTED'}})}
 async refine(authorId:string,id:string){const story=await this.db.story.findFirstOrThrow({where:{id,authorId}});if(story.creationType==='AUDIO') return this.db.story.update({where:{id},data:{refinementStatus:'QUEUED'}});return this.db.story.update({where:{id},data:{refinementStatus:'NARRATION_AVAILABLE'}})}
}
@ApiTags('stories') @Controller('v1/stories') export class StoriesController {constructor(private stories:StoriesService){}
 @Get('trending') trending(){return this.stories.trending()}
 @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get('mine') mine(@Req() req:any){return this.stories.mine(req.user.sub)}
 @Get() list(@Query('cursor') cursor?:string,@Query('q') q?:string){return this.stories.list(cursor,q)}
 @Get(':id') one(@Param('id') id:string){return this.stories.one(id)}
 @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post() create(@Req() req:any,@Body() dto:CreateStory){return this.stories.create(req.user.sub,dto)}
 @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post(':id/refine') refine(@Req() req:any,@Param('id') id:string){return this.stories.refine(req.user.sub,id)}
}
