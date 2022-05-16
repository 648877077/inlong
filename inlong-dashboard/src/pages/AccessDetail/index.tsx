/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Tabs, Button, Card, message, Steps, Space } from 'antd';
import { PageContainer, FooterToolbar } from '@/components/PageContainer';
import { parse } from 'qs';
import { useParams, useRequest, useSet, useHistory, useLocation } from '@/hooks';
import { useTranslation } from 'react-i18next';
import request from '@/utils/request';
import Info from './Info';
import DataSources from './DataSources';
import DataStream from './DataStream';
import DataStorage from './DataStorage';
import Audit from './Audit';

const Comp: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const history = useHistory();
  const { id: groupId } = useParams<{ id: string }>();

  const qs = parse(location.search.slice(1));

  const [current, setCurrent] = useState(+qs.step || 0);
  const [, { add: addOpened, has: hasOpened }] = useSet([current]);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [id, setId] = useState(groupId || '');

  const childRef = useRef(null);
  const [middlewareType, setMiddlewareType] = useState();

  const [isCreate] = useState(location.pathname.indexOf('/access/create') === 0);

  useEffect(() => {
    if (!hasOpened(current)) addOpened(current);
  }, [current, addOpened, hasOpened]);

  const { data } = useRequest(`/group/get/${id}`, {
    ready: !!id && !middlewareType,
    refreshDeps: [id],
    onSuccess: result => setMiddlewareType(result.middlewareType),
  });

  const isReadonly = useMemo(() => [0, 101, 102].includes(data?.status), [data]);

  const list = useMemo(
    () =>
      [
        {
          label: t('pages.AccessDetail.Business'),
          value: 'groupInfo',
          content: Info,
        },
        {
          label: t('pages.AccessDetail.DataStreams'),
          value: 'dataStream',
          content: DataStream,
        },
        {
          label: t('pages.AccessDetail.DataSources'),
          value: 'dataSources',
          content: DataSources,
        },
        {
          label: t('pages.AccessDetail.DataStorages'),
          value: 'streamSink',
          content: DataStorage,
        },
        {
          label: t('pages.AccessDetail.Audit'),
          value: 'audit',
          content: Audit,
          hidden: isReadonly || isCreate,
        },
      ].filter(item => !item.hidden),
    [isReadonly, isCreate, t],
  );

  const onOk = async current => {
    const onOk = childRef?.current?.onOk;

    setConfirmLoading(true);
    try {
      const result = onOk && (await onOk());
      if (current === 0) {
        setMiddlewareType(result.middlewareType);
        setId(result.inlongGroupId);
      }
      history.push({
        pathname: `/access/create/${result?.inlongGroupId || id}`,
        search: `?step=${current + 1}`,
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  const onSubmit = async () => {
    await request({
      url: `/group/startProcess/${id}`,
      method: 'POST',
    });
    message.success(t('pages.AccessCreate.SubmittedSuccessfully'));
    history.push('/access');
  };

  const Footer = () => (
    <Space style={{ display: 'flex', justifyContent: 'center' }}>
      {current > 0 && (
        <Button disabled={confirmLoading} onClick={() => setCurrent(current - 1)}>
          {t('pages.AccessCreate.Previous')}
        </Button>
      )}
      {current !== list.length - 1 && (
        <Button
          type="primary"
          loading={confirmLoading}
          onClick={async () => {
            await onOk(current).catch(err => {
              if (err?.errorFields?.length) {
                message.error(t('pages.AccessCreate.CheckFormIntegrity'));
              }
              return Promise.reject(err);
            });

            const newCurrent = current + 1;
            setCurrent(newCurrent);
          }}
        >
          {t('pages.AccessCreate.NextStep')}
        </Button>
      )}
      {current === list.length - 1 && (
        <Button type="primary" onClick={onSubmit}>
          {t('pages.AccessCreate.Submit')}
        </Button>
      )}
      <Button onClick={() => history.push('/access')}>{t('pages.AccessCreate.Back')}</Button>
    </Space>
  );

  const Div = isCreate ? Card : Tabs;

  return (
    <PageContainer
      breadcrumb={[
        {
          name: isCreate
            ? t('pages.AccessCreate.NewAccess')
            : `${t('pages.AccessDetail.BusinessDetail')}${id}`,
        },
      ]}
      useDefaultContainer={!isCreate}
    >
      {isCreate && (
        <Steps
          current={current}
          size="small"
          style={{ marginBottom: 20, width: 600 }}
          onChange={c => setCurrent(c)}
        >
          {list.map(item => (
            <Steps.Step key={item.label} title={item.label} />
          ))}
        </Steps>
      )}

      <Div>
        {list.map(({ content: Content, ...item }, index) => {
          // Lazy load the content of the step, and at the same time make the loaded useCache content not destroy
          const child =
            !isCreate || hasOpened(index) ? (
              <Content
                inlongGroupId={id}
                readonly={isReadonly}
                middlewareType={middlewareType}
                isCreate={isCreate}
                ref={index === current ? childRef : null}
              />
            ) : null;

          return isCreate ? (
            <div key={item.label} style={{ display: `${index === current ? 'block' : 'none'}` }}>
              {child}
            </div>
          ) : (
            <Tabs.TabPane tab={item.label} key={item.value}>
              {child}
            </Tabs.TabPane>
          );
        })}
      </Div>

      {isCreate && <FooterToolbar extra={<Footer />} />}
    </PageContainer>
  );
};

export default Comp;
