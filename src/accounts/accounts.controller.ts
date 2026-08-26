import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AccountsService } from './accounts.service';
import { AccountResponseDto } from './dto/account-response.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token is invalid' })
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({ type: AccountResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all owned accounts, including inactive ones' })
  @ApiOkResponse({ type: AccountResponseDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccountResponseDto[]> {
    return this.accountsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an owned account' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Account not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an owned account' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Account not found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an owned account' })
  @ApiNoContentResponse({ description: 'Account deactivated' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiConflictResponse({
    description: 'At least one active account must remain',
  })
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.accountsService.deactivate(user.id, id);
  }
}
