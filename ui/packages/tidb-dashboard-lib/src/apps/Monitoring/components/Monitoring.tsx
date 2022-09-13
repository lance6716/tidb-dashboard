import { Space, Typography, Row, Col, Collapse, Tooltip } from 'antd'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AutoRefreshButton,
  Card,
  DEFAULT_TIME_RANGE,
  MetricChart,
  TimeRange,
  TimeRangeSelector,
  GraphType,
  Toolbar
} from '@lib/components'
import { Stack } from 'office-ui-fabric-react'
import { useTimeRangeValue } from '@lib/components/TimeRangeSelector/hook'
import { LoadingOutlined, FileTextOutlined } from '@ant-design/icons'
import { MonitoringContext } from '../context'

import { PointerEvent } from '@elastic/charts'
import { ChartContext } from '@lib/components/MetricChart/ChartContext'
import { useEventEmitter, useMemoizedFn } from 'ahooks'
import { debounce } from 'lodash'
import { store } from '@lib/utils/store'
import { telemetry } from '../utils/telemetry'

export default function Monitoring() {
  const ctx = useContext(MonitoringContext)
  const info = store.useState((s) => s.appInfo)
  const pdVersion = info?.version?.pd_version
  const { t } = useTranslation()

  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE)
  const [chartRange, setChartRange] = useTimeRangeValue(timeRange, setTimeRange)
  const loadingCounter = useRef(0)
  const [isSomeLoading, setIsSomeLoading] = useState(false)

  // eslint-disable-next-line
  const setIsSomeLoadingDebounce = useCallback(
    debounce(setIsSomeLoading, 100, { leading: true }),
    []
  )

  const onLoadingStateChange = useMemoizedFn((loading: boolean) => {
    loading
      ? (loadingCounter.current += 1)
      : loadingCounter.current > 0 && (loadingCounter.current -= 1)
    setIsSomeLoadingDebounce(loadingCounter.current > 0)
  })

  const handleManualRefreshClick = () => {
    telemetry.clickManualRefresh()
    return setTimeRange((r) => ({ ...r }))
  }

  return (
    <>
      <Card>
        <Toolbar>
          <Space>
            <TimeRangeSelector.WithZoomOut
              value={timeRange}
              onChange={(v) => {
                setTimeRange(v)
                telemetry.selectTimeRange(v)
              }}
              recent_seconds={ctx?.cfg.timeRangeSelector?.recent_seconds}
              withAbsoluteRangePicker={
                ctx?.cfg.timeRangeSelector?.withAbsoluteRangePicker
              }
              onZoomOutClick={(start, end) =>
                telemetry.clickZoomOut([start, end])
              }
            />
            <AutoRefreshButton
              onChange={telemetry.selectAutoRefreshOption}
              onRefresh={handleManualRefreshClick}
              disabled={isSomeLoading}
            />
            <Tooltip placement="top" title={t('monitoring.panel_no_data_tips')}>
              <a
                // TODO: replace reference link on op side
                href="https://docs.pingcap.com/tidbcloud/built-in-monitoring"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileTextOutlined
                  onClick={() => telemetry.clickDocumentationIcon()}
                />
              </a>
            </Tooltip>
            {isSomeLoading && <LoadingOutlined />}
          </Space>
        </Toolbar>
      </Card>
      <ChartContext.Provider value={useEventEmitter<PointerEvent>()}>
        <Stack tokens={{ childrenGap: 16 }}>
          <Card noMarginTop noMarginBottom>
            {ctx!.cfg.getMetricsQueries(pdVersion).map((item) => (
              <Collapse defaultActiveKey={['1']} ghost key={item.category}>
                <Collapse.Panel
                  header={t(`monitoring.category.${item.category}`)}
                  key="1"
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    padding: 0,
                    marginLeft: -16
                  }}
                >
                  <Row gutter={[16, 16]}>
                    {item.metrics.map((m) => (
                      <Col xl={12} sm={24} key={m.title}>
                        <Card
                          noMargin
                          style={{
                            border: '1px solid #f1f0f0',
                            padding: '10px 2rem',
                            backgroundColor: '#fcfcfd'
                          }}
                        >
                          <Typography.Title
                            level={5}
                            style={{ textAlign: 'center' }}
                          >
                            {m.title}
                          </Typography.Title>
                          <MetricChart
                            queries={m.queries}
                            type={m.type as GraphType}
                            unit={m.unit}
                            nullValue={m.nullValue}
                            range={chartRange}
                            onRangeChange={setChartRange}
                            getMetrics={ctx!.ds.metricsQueryGet}
                            onLoadingStateChange={onLoadingStateChange}
                            promAddrConfigurable={
                              ctx!.cfg.promeAddrConfigurable
                            }
                            onClickSeriesLabel={(seriesName) =>
                              telemetry.clickSeriesLabel(m.title, seriesName)
                            }
                          />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Collapse.Panel>
              </Collapse>
            ))}
          </Card>
        </Stack>
      </ChartContext.Provider>
    </>
  )
}