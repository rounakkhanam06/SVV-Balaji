import { useEffect, useState } from 'react';
import { App as AntApp, Button, InputNumber, Popover, Space, Typography } from 'antd';
import { useCanKey } from '@shared/auth/useCan';
import { apiErrorMessage } from '../../api/client';
import { useProductionSettings, useUpdateProductionSettings } from '../../hooks/useProduction';

/**
 * Super Admin sets how far raw material may differ from the recipe (over or
 * under) before a Production Manager must approve (client decision 24 Nov 2026).
 */
export function ConsumptionToleranceSetting() {
  const can = useCanKey();
  const settings = useProductionSettings();
  const update = useUpdateProductionSettings();
  const { message } = AntApp.useApp();
  const current = settings.data ? Number(settings.data.consumptionTolerancePercent) : null;
  const [value, setValue] = useState<number | null>(current);
  useEffect(() => setValue(current), [current]);

  if (!can('productionSettings.manage')) return null;

  const save = async () => {
    if (value === null) return;
    try {
      await update.mutateAsync({ consumptionTolerancePercent: value });
      message.success(`Consumption limit set to ±${value}%`);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Could not save'), 8);
    }
  };

  return (
    <Popover
      trigger="click"
      title="Raw material limit"
      content={
        <Space direction="vertical" style={{ maxWidth: 280 }}>
          <Typography.Text type="secondary">
            Allowed difference between raw material used and the recipe, over or under. Outside it, a Production Manager must approve the run.
          </Typography.Text>
          <Space>
            <InputNumber min={0} max={50} step={0.5} value={value} onChange={(v) => setValue(v)} addonAfter="%" />
            <Button type="primary" loading={update.isPending} onClick={() => void save()}>
              Save
            </Button>
          </Space>
        </Space>
      }
    >
      <Button>Limit ±{current ?? '…'}%</Button>
    </Popover>
  );
}
