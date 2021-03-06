import { expect, haveResource, haveResourceLike, ResourcePart } from '@aws-cdk/assert';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as secretsmanager from '../lib';

export = {
  'default secret'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new secretsmanager.Secret(stack, 'Secret');

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::Secret', {
      GenerateSecretString: {},
    }));

    test.done();
  },

  'set removalPolicy to secret'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new secretsmanager.Secret(stack, 'Secret', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::SecretsManager::Secret',
      {
        DeletionPolicy: 'Retain',
      }, ResourcePart.CompleteDefinition,
    ));

    test.done();
  },

  'secret with kms'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'KMS');

    // WHEN
    new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });

    // THEN
    expect(stack).to(haveResourceLike('AWS::KMS::Key', {
      KeyPolicy: {
        Statement: [
          {},
          {
            Effect: 'Allow',
            Resource: '*',
            Action: [
              'kms:Decrypt',
              'kms:Encrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
            ],
            Principal: {
              AWS: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':iam::',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':root',
                  ],
                ],
              },
            },
            Condition: {
              StringEquals: {
                'kms:ViaService': {
                  'Fn::Join': [
                    '',
                    [
                      'secretsmanager.',
                      {
                        Ref: 'AWS::Region',
                      },
                      '.amazonaws.com',
                    ],
                  ],
                },
              },
            },
          },
          {
            Effect: 'Allow',
            Resource: '*',
            Action: [
              'kms:CreateGrant',
              'kms:DescribeKey',
            ],
            Principal: {
              AWS: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':iam::',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':root',
                  ],
                ],
              },
            },
            Condition: {
              StringEquals: {
                'kms:ViaService': {
                  'Fn::Join': [
                    '',
                    [
                      'secretsmanager.',
                      {
                        Ref: 'AWS::Region',
                      },
                      '.amazonaws.com',
                    ],
                  ],
                },
              },
            },
          },
        ],
        Version: '2012-10-17',
      },
    }));
    test.done();
  },

  'secret with generate secret string options'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new secretsmanager.Secret(stack, 'Secret', {
      generateSecretString: {
        excludeUppercase: true,
        passwordLength: 20,
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        ExcludeUppercase: true,
        PasswordLength: 20,
      },
    }));

    test.done();
  },

  'templated secret string'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new secretsmanager.Secret(stack, 'Secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'username' }),
        generateStringKey: 'password',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        SecretStringTemplate: '{"username":"username"}',
        GenerateStringKey: 'password',
      },
    }));

    test.done();
  },

  'grantRead'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'KMS');
    const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
    const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

    // WHEN
    secret.grantRead(role);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          Effect: 'Allow',
          Resource: { Ref: 'SecretA720EF05' },
        }],
      },
    }));
    expect(stack).to(haveResourceLike('AWS::KMS::Key', {
      KeyPolicy: {
        Statement: [
          {},
          {},
          {},
          {
            Action: 'kms:Decrypt',
            Condition: {
              StringEquals: {
                'kms:ViaService': {
                  'Fn::Join': [
                    '',
                    [
                      'secretsmanager.',
                      {
                        Ref: 'AWS::Region',
                      },
                      '.amazonaws.com',
                    ],
                  ],
                },
              },
            },
            Effect: 'Allow',
            Principal: {
              AWS: {
                'Fn::GetAtt': [
                  'Role1ABCC5F0',
                  'Arn',
                ],
              },
            },
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    }));
    test.done();
  },

  'grantRead with version label constraint'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'KMS');
    const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
    const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

    // WHEN
    secret.grantRead(role, ['FOO', 'bar']);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          Effect: 'Allow',
          Resource: { Ref: 'SecretA720EF05' },
          Condition: {
            'ForAnyValue:StringEquals': {
              'secretsmanager:VersionStage': ['FOO', 'bar'],
            },
          },
        }],
      },
    }));
    expect(stack).to(haveResourceLike('AWS::KMS::Key', {
      KeyPolicy: {
        Statement: [
          {},
          {},
          {},
          {
            Action: 'kms:Decrypt',
            Condition: {
              StringEquals: {
                'kms:ViaService': {
                  'Fn::Join': [
                    '',
                    [
                      'secretsmanager.',
                      {
                        Ref: 'AWS::Region',
                      },
                      '.amazonaws.com',
                    ],
                  ],
                },
              },
            },
            Effect: 'Allow',
            Principal: {
              AWS: {
                'Fn::GetAtt': [
                  'Role1ABCC5F0',
                  'Arn',
                ],
              },
            },
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    }));
    test.done();
  },

  'grantWrite'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret', {});
    const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

    // WHEN
    secret.grantWrite(role);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'secretsmanager:PutSecretValue',
            'secretsmanager:UpdateSecret',
          ],
          Effect: 'Allow',
          Resource: { Ref: 'SecretA720EF05' },
        }],
      },
    }));
    test.done();
  },

  'grantWrite with kms'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'KMS');
    const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
    const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

    // WHEN
    secret.grantWrite(role);

    // THEN
    const expectStack = expect(stack);
    expectStack.to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'secretsmanager:PutSecretValue',
            'secretsmanager:UpdateSecret',
          ],
          Effect: 'Allow',
          Resource: { Ref: 'SecretA720EF05' },
        }],
      },
    }));
    expectStack.to(haveResourceLike('AWS::KMS::Key', {
      KeyPolicy: {
        Statement: [
          {},
          {},
          {},
          {
            Action: [
              'kms:Encrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
            ],
            Condition: {
              StringEquals: {
                'kms:ViaService': {
                  'Fn::Join': [
                    '',
                    [
                      'secretsmanager.',
                      {
                        Ref: 'AWS::Region',
                      },
                      '.amazonaws.com',
                    ],
                  ],
                },
              },
            },
            Effect: 'Allow',
            Principal: {
              AWS: {
                'Fn::GetAtt': [
                  'Role1ABCC5F0',
                  'Arn',
                ],
              },
            },
            Resource: '*',
          },
        ],
      },
    }));
    test.done();
  },

  'secretValue'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'KMS');
    const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });

    // WHEN
    new cdk.CfnResource(stack, 'FakeResource', {
      type: 'CDK::Phony::Resource',
      properties: {
        value: secret.secretValue,
      },
    });

    // THEN
    expect(stack).to(haveResource('CDK::Phony::Resource', {
      value: {
        'Fn::Join': ['', [
          '{{resolve:secretsmanager:',
          { Ref: 'SecretA720EF05' },
          ':SecretString:::}}',
        ]],
      },
    }));
    test.done();
  },

  'import by secretArn'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

    // WHEN
    const secret = secretsmanager.Secret.fromSecretArn(stack, 'Secret', secretArn);

    // THEN
    test.equals(secret.secretArn, secretArn);
    test.equals(secret.secretName, 'MySecret');
    test.same(secret.encryptionKey, undefined);
    test.deepEqual(stack.resolve(secret.secretValue), `{{resolve:secretsmanager:${secretArn}:SecretString:::}}`);
    test.deepEqual(stack.resolve(secret.secretValueFromJson('password')), `{{resolve:secretsmanager:${secretArn}:SecretString:password::}}`);
    test.done();
  },

  'import by secretArn throws if ARN is malformed'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const arnWithoutResourceName = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret';
    const arnWithoutSecretsManagerSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret';

    // WHEN
    test.throws(() => secretsmanager.Secret.fromSecretArn(stack, 'Secret1', arnWithoutResourceName), /invalid ARN format/);
    test.throws(() => secretsmanager.Secret.fromSecretArn(stack, 'Secret2', arnWithoutSecretsManagerSuffix), /invalid ARN format/);
    test.done();
  },

  'import by attributes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const encryptionKey = new kms.Key(stack, 'KMS');
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

    // WHEN
    const secret = secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretArn, encryptionKey,
    });

    // THEN
    test.equals(secret.secretArn, secretArn);
    test.equals(secret.secretName, 'MySecret');
    test.same(secret.encryptionKey, encryptionKey);
    test.deepEqual(stack.resolve(secret.secretValue), `{{resolve:secretsmanager:${secretArn}:SecretString:::}}`);
    test.deepEqual(stack.resolve(secret.secretValueFromJson('password')), `{{resolve:secretsmanager:${secretArn}:SecretString:password::}}`);
    test.done();
  },

  'import by secret name'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secretName = 'MySecret';

    // WHEN
    const secret = secretsmanager.Secret.fromSecretName(stack, 'Secret', secretName);

    // THEN
    test.equals(secret.secretArn, secretName);
    test.equals(secret.secretName, secretName);
    test.deepEqual(stack.resolve(secret.secretValue), `{{resolve:secretsmanager:${secretName}:SecretString:::}}`);
    test.deepEqual(stack.resolve(secret.secretValueFromJson('password')), `{{resolve:secretsmanager:${secretName}:SecretString:password::}}`);
    test.done();
  },

  'import by secret name with grants'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
    const secret = secretsmanager.Secret.fromSecretName(stack, 'Secret', 'MySecret');

    // WHEN
    secret.grantRead(role);
    secret.grantWrite(role);

    // THEN
    const expectedSecretReference = {
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        ':secretsmanager:',
        { Ref: 'AWS::Region' },
        ':',
        { Ref: 'AWS::AccountId' },
        ':secret:MySecret*',
      ]],
    };
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          Effect: 'Allow',
          Resource: expectedSecretReference,
        },
        {
          Action: [
            'secretsmanager:PutSecretValue',
            'secretsmanager:UpdateSecret',
          ],
          Effect: 'Allow',
          Resource: expectedSecretReference,
        }],
      },
    }));

    test.done();
  },

  'can attach a secret with attach()'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // WHEN
    secret.attach({
      asSecretAttachmentTarget: () => ({
        targetId: 'target-id',
        targetType: 'target-type' as secretsmanager.AttachmentTargetType,
      }),
    });

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::SecretTargetAttachment', {
      SecretId: {
        Ref: 'SecretA720EF05',
      },
      TargetId: 'target-id',
      TargetType: 'target-type',
    }));

    test.done();
  },

  'throws when trying to attach a target multiple times to a secret'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const target = {
      asSecretAttachmentTarget: () => ({
        targetId: 'target-id',
        targetType: 'target-type' as secretsmanager.AttachmentTargetType,
      }),
    };
    secret.attach(target);

    // THEN
    test.throws(() => secret.attach(target), /Secret is already attached to a target/);

    test.done();
  },

  'add a rotation schedule to an attached secret'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const attachedSecret = secret.attach({
      asSecretAttachmentTarget: () => ({
        targetId: 'target-id',
        targetType: 'target-type' as secretsmanager.AttachmentTargetType,
      }),
    });
    const rotationLambda = new lambda.Function(stack, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('export.handler = event => event;'),
      handler: 'index.handler',
    });

    // WHEN
    attachedSecret.addRotationSchedule('RotationSchedule', {
      rotationLambda,
    });

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: {
        Ref: 'SecretAttachment2E1B7C3B', // The secret returned by the attachment, not the secret itself.
      },
    }));

    test.done();
  },

  'throws when specifying secretStringTemplate but not generateStringKey'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // THEN
    test.throws(() => new secretsmanager.Secret(stack, 'Secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'username' }),
      },
    }), /`secretStringTemplate`.+`generateStringKey`/);

    test.done();
  },

  'throws when specifying generateStringKey but not secretStringTemplate'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // THEN
    test.throws(() => new secretsmanager.Secret(stack, 'Secret', {
      generateSecretString: {
        generateStringKey: 'password',
      },
    }), /`secretStringTemplate`.+`generateStringKey`/);

    test.done();
  },

  'equivalence of SecretValue and Secret.fromSecretAttributes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

    // WHEN
    const imported = secretsmanager.Secret.fromSecretAttributes(stack, 'Imported', { secretArn: secretArn }).secretValueFromJson('password');
    const value = cdk.SecretValue.secretsManager(secretArn, { jsonField: 'password' });

    // THEN
    test.deepEqual(stack.resolve(imported), stack.resolve(value));
    test.done();
  },

  'can add to the resource policy of a secret'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // WHEN
    secret.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
      principals: [new iam.ArnPrincipal('arn:aws:iam::123456789012:user/cool-user')],
    }));

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::ResourcePolicy', {
      ResourcePolicy: {
        Statement: [
          {
            Action: 'secretsmanager:GetSecretValue',
            Effect: 'Allow',
            Principal: {
              AWS: 'arn:aws:iam::123456789012:user/cool-user',
            },
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      SecretId: {
        Ref: 'SecretA720EF05',
      },
    }));

    test.done();
  },

  'fails if secret policy has no actions'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // WHEN
    secret.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    // THEN
    test.throws(() => app.synth(), /A PolicyStatement must specify at least one \'action\' or \'notAction\'/);
    test.done();
  },

  'fails if secret policy has no IAM principals'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // WHEN
    secret.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['secretsmanager:*'],
    }));

    // THEN
    test.throws(() => app.synth(), /A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);
    test.done();
  },
};
