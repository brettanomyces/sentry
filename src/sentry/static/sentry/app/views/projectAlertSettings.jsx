import React from 'react';
import underscore from 'underscore';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import ListLink from '../components/listLink';
import {DefaultPlugin} from '../plugin';
import {FormState, RangeField} from '../components/forms';
import {t} from '../locale';

const ProjectDigestSettings = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    initialData: React.PropTypes.object,
    onSave: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      formData: Object.assign({}, this.props.initialData),
      errors: {},
    };
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState({
      state: FormState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      let {orgId, projectId} = this.props;
      this.api.request(`/projects/${orgId}/${projectId}/`, {
        method: 'PUT',
        data: this.state.formData,
        success: (data) => {
          this.props.onSave(data);
          this.setState({
            state: FormState.READY,
            errors: {},
          });
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },


  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let {errors, formData} = this.state;
    let hasChanges = !underscore.isEqual(this.props.initialData, formData);
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Digests')}</h3>
        </div>
        <div className="box-content with-padding">
          <p>
            {t(
              'Sentry will automatically digest alerts sent ' +
              'by some services to avoid flooding your inbox ' +
              'with individual issue notifications. To control ' +
              'how frequently notifications are delivered, use ' +
              'the sliders below.'
            )}
          </p>
          <form onSubmit={this.onSubmit} className="form-stacked">
            {this.state.state === FormState.ERROR &&
              <div className="alert alert-error alert-block">
                {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
              </div>
            }
            <div className="row">
              <div className="col-md-6">
                <RangeField
                  min={60}
                  max={3600}
                  step={60}
                  defaultValue={300}
                  label={t('Minimum delivery frequency')}
                  help={t('Notifications will be delivered at most this often.')}
                  name="digestsMinDelay"
                  value={formData.digestsMinDelay}
                  error={errors.digestsMinDelay}
                  formatLabel={RangeField.formatMinutes}
                  onChange={this.onFieldChange.bind(this, 'digestsMinDelay')} />
              </div>
              <div className="col-md-6">
                <RangeField
                  min={60}
                  max={3600}
                  step={60}
                  defaultValue={3600}
                  label={t('Maximum delivery frequency')}
                  help={t('Notifications will be delivered at least this often.')}
                  name="digestsMaxDelay"
                  value={formData.digestsMaxDelay}
                  error={errors.digestsMaxDelay}
                  formatLabel={RangeField.formatMinutes}
                  onChange={this.onFieldChange.bind(this, 'digestsMaxDelay')} />
              </div>
            </div>

            <fieldset className="form-actions align-right">
              <button type="submit" className="btn btn-primary"
                      disabled={isSaving || !hasChanges}>{t('Save Changes')}</button>
            </fieldset>
          </form>
        </div>
      </div>
    );
  },
});

const InactivePlugins = React.createClass({
  propTypes: {
    plugins: React.PropTypes.array.isRequired,
    onEnablePlugin: React.PropTypes.func.isRequired,
  },

  enablePlugin(plugin) {
    return this.props.onEnablePlugin(plugin, true);
  },

  render() {
    let plugins = this.props.plugins;
    if (plugins.length === 0)
      return null;
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Inactive Integrations')}</h3>
        </div>
        <div className="box-content with-padding">
          <ul className="integration-list">
            {plugins.map((plugin) => {
              return (
                <li key={plugin.id}>
                  <button onClick={this.enablePlugin.bind(this, plugin)}>
                    {plugin.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
});

const ProjectAlertSettings = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      project: this.props.project,
    };
  },

  onDigestsChange(data) {
    // TODO(dcramer): propagate this in a more correct way
    let project = this.state.project;
    project.digestsMinDelay = data.digestsMinDelay;
    project.digestsMaxDelay = data.digestsMaxDelay;
    this.setState({project: project});
  },

  togglePlugin(plugin, enable) {
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/plugins/${plugin.id}/`, {
      method: enable !== false ? 'POST' : 'DELETE',
      data: this.state.formData,
      success: (data) => {
        // TODO(dcramer): propagate this in a more correct way
        plugin = this.state.project.plugins.find(p => p.id === plugin.id);
        plugin.enabled = enable;
        this.setState({project: this.state.project});
      },
      error: (error) => {
        IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    let {orgId, projectId} = this.props.params;
    let organization = this.props.organization;
    let project = this.state.project;
    let plugins = project.plugins.filter(p => p.type == 'notification');
    return (
      <div>
        <a href={`/${orgId}/${projectId}/settings/alerts/new/`}
           className="btn pull-right btn-primary btn-sm">
          <span className="icon-plus" />
          {t('New Alert Rule')}
        </a>
        <h2>{t('Alerts')}</h2>

        <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
          <ListLink to={`/${orgId}/${projectId}/settings/alerts/`}
                    index={true}>{t('Settings')}</ListLink>
          <ListLink to={`/${orgId}/${projectId}/settings/alerts/rules/`}>{t('Rules')}</ListLink>
        </ul>

        <ProjectDigestSettings
          orgId={orgId}
          projectId={projectId}
          initialData={{
            'digestsMinDelay': project.digestsMinDelay,
            'digestsMaxDelay': project.digestsMaxDelay
          }}
          onSave={this.onDigestsChange} />

        {plugins.filter(p => p.enabled).map((plugin) => {
          // TODO(dcramer): switch window.SentryPlugins out with a plugin registry/cache
          let pluginCls = (window.SentryPlugins[plugin.id] || DefaultPlugin);
          console.log('[plugins] Loading ' + plugin.id + ' from ' + pluginCls.name);
          let pluginObj = new (pluginCls)();
          return (
            <div className="box" key={plugin.id}>
              <div className="box-header">
                {plugin.canDisable &&
                  <div className="pull-right">
                    <a className="btn btn-sm btn-default"
                       onClick={this.togglePlugin.bind(this, plugin, false)}>{t('Disable')}</a>
                  </div>
                }
                <h3>{plugin.name}</h3>
              </div>
              <div className="box-content with-padding">
                {pluginObj.renderSettings({
                  organization: organization,
                  project: project,
                  plugin: plugin,
                })}
              </div>
            </div>
          );
        })}

        <InactivePlugins
            plugins={plugins.filter(p => !p.enabled)}
            onEnablePlugin={this.togglePlugin} />

      </div>
    );
  }
});

export default ProjectAlertSettings;