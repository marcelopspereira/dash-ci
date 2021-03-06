﻿namespace DashCI.Widgets.TfsPostIt {
    export interface ITfsPostItData extends Models.IWidgetData {
        project?: string;
        team?: string;
        queryId?: string;

        poolInterval?: number;

        postItColor?: string;

        columns?: number;

    }


    export class TfsPostItController implements ng.IController {
        public static $inject = ["$scope", "$q", "$timeout", "$interval", "$mdDialog", "tfsResources"];

        private data: ITfsPostItData;

        constructor(
            private $scope: Models.IWidgetScope,
            private $q: ng.IQService,
            private $timeout: ng.ITimeoutService,
            private $interval: ng.IIntervalService,
            private $mdDialog: ng.material.IDialogService,
            private tfsResources: () => Resources.Tfs.ITfsResource
        ) {
            this.data = this.$scope.data;
            this.data.id = Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
            this.data.type = Models.WidgetType.tfsPostIt;
            this.data.footer = false;
            this.data.header = true;

            this.$scope.$watch(
                () => this.$scope.$element.height(),
                (height: number) => this.sizeFont(height)
            );
            this.$scope.$watch(
                () => this.data.poolInterval,
                (value: number) => this.updateInterval()
            );
            this.$scope.$on("$destroy", () => this.finalize());

            this.init();
        }
        $onInit() { }
        private handle: ng.IPromise<any>;
        private finalize() {
            if (this.handle) {
                this.$timeout.cancel(this.handle);
                this.$interval.cancel(this.handle);
            }
            DashCI.DEBUG && console.log("dispose: " + this.data.id + "-" + this.data.title);
        }


        private init() {
            this.data.title = this.data.title || "PostIt";
            this.data.color = "transparent";
            this.data.postItColor = this.data.postItColor || "amber";
            this.data.columns = this.data.columns || 1;

            //default values
            this.data.poolInterval = this.data.poolInterval || 10000;

            this.updateInterval();
        }

        private sizeFont(height: number) {
            //var p = this.$scope.$element.find("p");
            //var fontSize = Math.round(height / 1.3) + "px";
            //var lineSize = Math.round((height) - 60) + "px";
            //p.css('font-size', fontSize);
            //p.css('line-height', lineSize);
        }

        public config() {
            this.$mdDialog.show({
                controller: TfsPostItConfigController,
                controllerAs: "ctrl",
                templateUrl: 'app/widgets/tfs-postit/config.html',
                parent: angular.element(document.body),
                //targetEvent: ev,
                clickOutsideToClose: true,
                fullscreen: false,
                resolve: {
                    config: () => {
                        var deferred = this.$q.defer();
                        this.$timeout(() => deferred.resolve(this.data), 1);
                        return deferred.promise;
                    }
                }
            });
            //.then((ok) => this.createWidget(type));

        }

        public count: number = null;
        public list: PostItListItem[] = null;
        public colorClass: string;

        private updateInterval() {
            if (this.handle) {
                this.$timeout.cancel(this.handle);
                this.$interval.cancel(this.handle);
            }
            this.handle = this.$timeout(() => {
                this.handle = this.$interval(() => this.update(), this.data.poolInterval);
            }, DashCI.randomNess()); //this should create some randomness to avoid a lot of calls at the same moment.
            this.update();
        }
        private update() {
            var res = this.tfsResources();
            if (!res)
                return;

            DashCI.DEBUG && console.log("start Tfs request: " + this.data.id + "; " + this.data.title + "; " + new Date().toLocaleTimeString("en-us") + "; ");
            res.run_query({
                project: this.data.project,
                team: this.data.team,
                queryId: this.data.queryId
            }).$promise.then((newPostIt: Resources.Tfs.IRunQueryResult) => {
                //var newPostIt = Math.round(Math.random() * 100);

                var order = mx(newPostIt.workItems).select(x => x.id).toArray();
                var ids = order.join(",");

                res.get_workitems({
                    ids: ids
                }).$promise.then((data: Resources.Tfs.IWorkItemsResult) => {


                    if (data.count != this.count) {
                        this.count = data.count;
                        var p = this.$scope.$element.find("p");

                        p.addClass('changed');
                        this.$timeout(() => p.removeClass('changed'), 1000);
                    }

                    this.list = mx(data.value)
                        .orderBy(x=> order.indexOf(x.id))
                        .select((item) => {
                            var title = item.fields["System.Title"];
                            var resume = item.fields["System.IterationPath"];
                            var desc =  item.fields["System.AssignedTo"];
                            if (desc && desc.indexOf("<") > -1)
                                desc = desc.substr(0, desc.indexOf("<")).trim();
                            if (resume && resume.indexOf("\\") > -1)
                                resume = resume.substr(resume.indexOf("\\") + 1);


                            var ret = <PostItListItem>{
                                avatarUrl: null,
                                resume: resume,
                                description: desc,
                                title: title,
                                colorClass: this.data.postItColor
                            };
                            return ret;

                    }).toArray();

                    DashCI.DEBUG && console.log("end Tfs request: " + this.data.id + "; " + this.data.title + "; " + new Date().toLocaleTimeString("en-us") + "; ");
                });

            })
            .catch((reason) => {
                this.count = null;
                console.error(reason);
            });
            this.$timeout(() => this.sizeFont(this.$scope.$element.height()), 500);
        }

    }

    export class PostItListItem {
        public avatarUrl: string;
        public title: string;
        public resume: string;
        public description: string;
        public colorClass: string;
    }

}